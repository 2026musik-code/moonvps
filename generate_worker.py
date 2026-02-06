import os
import base64

def main():
    try:
        with open('public/index.html', 'r') as f:
            html = f.read()

        with open('public/style.css', 'r') as f:
            css = f.read()

        with open('public/app.js', 'r') as f:
            js = f.read()

        # Inject CSS
        html = html.replace('<link rel="stylesheet" href="style.css">', f'<style>{css}</style>')

        # Inject JS
        html = html.replace('<script src="app.js"></script>', f'<script>{js}</script>')

        # Encode as base64 to ensure safe embedding in JS
        html_b64 = base64.b64encode(html.encode('utf-8')).decode('utf-8')

        worker_script = f"""
export default {{
  async fetch(request, env) {{
    const url = new URL(request.url);
    const path = url.pathname;

    // API Routes
    if (path === '/api/chats') {{
      return await handleListChats(env);
    }} else if (path === '/api/chat') {{
      if (request.method === 'GET') {{
        return await handleGetChat(request, env);
      }} else if (request.method === 'POST') {{
        return await handleSaveChat(request, env);
      }}
    }}

    // GitHub Auth Routes
    else if (path === '/api/auth/github/login') {{
      return handleGithubLogin(env);
    }} else if (path === '/api/auth/github/callback') {{
      return handleGithubCallback(request, env);
    }} else if (path === '/api/auth/github/status') {{
      return handleGithubStatus(request);
    }} else if (path === '/api/auth/github/logout') {{
      return handleGithubLogout();
    }} else if (path === '/api/github/repos') {{
      return handleGithubRepos(request);
    }}

    // Serve Static App
    if (path === '/' || path === '/index.html') {{
      const binaryString = atob("{html_b64}");
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {{
        bytes[i] = binaryString.charCodeAt(i);
      }}
      const decodedHtml = new TextDecoder('utf-8').decode(bytes);

      return new Response(decodedHtml, {{
        headers: {{
          'content-type': 'text/html;charset=UTF-8',
        }},
      }});
    }}

    return new Response('Not Found', {{ status: 404 }});
  }},
}};

// --- R2 Logic ---

async function handleListChats(env) {{
  if (!env.BUCKET) {{
    return new Response(JSON.stringify({{ error: 'R2 Bucket not configured' }}), {{ status: 500 }});
  }}

  try {{
    const list = await env.BUCKET.list();
    const chats = [];

    for (const obj of list.objects) {{
        let title = 'Chat ' + obj.key.substring(0, 8);
        if (obj.customMetadata && obj.customMetadata.title) {{
            title = obj.customMetadata.title;
        }}

        chats.push({{
            id: obj.key,
            title: title,
            uploaded: obj.uploaded
        }});
    }}

    return new Response(JSON.stringify({{ chats }}), {{
      headers: {{ 'Content-Type': 'application/json' }}
    }});
  }} catch (e) {{
    return new Response(JSON.stringify({{ error: e.message }}), {{ status: 500 }});
  }}
}}

async function handleGetChat(request, env) {{
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response('Missing ID', {{ status: 400 }});

  const object = await env.BUCKET.get(id);
  if (object === null) {{
    return new Response('Chat not found', {{ status: 404 }});
  }}

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Content-Type', 'application/json');

  return new Response(object.body, {{ headers }});
}}

async function handleSaveChat(request, env) {{
  try {{
    const body = await request.json();
    const id = body.id;
    if (!id) return new Response('Missing ID', {{ status: 400 }});

    const title = body.title || 'Untitled Chat';

    await env.BUCKET.put(id, JSON.stringify(body), {{
        customMetadata: {{ title: title }}
    }});

    return new Response(JSON.stringify({{ success: true }}), {{
      headers: {{ 'Content-Type': 'application/json' }}
    }});
  }} catch (e) {{
    return new Response(JSON.stringify({{ error: e.message }}), {{ status: 500 }});
  }}
}}

// --- GitHub Auth Logic ---

function handleGithubLogin(env) {{
  const client_id = env.GITHUB_CLIENT_ID;
  if (!client_id || client_id === "YOUR_GITHUB_CLIENT_ID") {{
    return new Response("GitHub Client ID not configured", {{ status: 500 }});
  }}

  const redirect_uri = "https://github.com/login/oauth/authorize";
  const params = new URLSearchParams({{
    client_id: client_id,
    scope: "repo user",
  }});

  return Response.redirect(`${{redirect_uri}}?${{params}}`, 302);
}}

async function handleGithubCallback(request, env) {{
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) return new Response("Missing code", {{ status: 400 }});

  const client_id = env.GITHUB_CLIENT_ID;
  const client_secret = env.GITHUB_CLIENT_SECRET;

  try {{
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {{
      method: "POST",
      headers: {{
        "Content-Type": "application/json",
        Accept: "application/json",
      }},
      body: JSON.stringify({{
        client_id,
        client_secret,
        code,
      }}),
    }});

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {{
        return new Response(tokenData.error_description || "GitHub Error", {{ status: 400 }});
    }}

    const accessToken = tokenData.access_token;

    // Create a simple session cookie
    const cookie = serialize('gh_token', accessToken, {{
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
    }});

    // Redirect to home
    return new Response(null, {{
        status: 302,
        headers: {{
            'Location': '/',
            'Set-Cookie': cookie
        }}
    }});

  }} catch (e) {{
    return new Response(e.message, {{ status: 500 }});
  }}
}}

async function handleGithubStatus(request) {{
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parse(cookieHeader || "");
  const token = cookies.gh_token;

  if (!token) {{
      return new Response(JSON.stringify({{ connected: false }}), {{
          headers: {{ 'Content-Type': 'application/json' }}
      }});
  }}

  // Verify token and get user info
  try {{
      const userRes = await fetch("https://api.github.com/user", {{
          headers: {{
              "Authorization": `Bearer ${{token}}`,
              "User-Agent": "Nexus-AI-Worker"
          }}
      }});

      if (!userRes.ok) {{
          // Token invalid
          return new Response(JSON.stringify({{ connected: false }}), {{
            headers: {{ 'Content-Type': 'application/json' }}
        }});
      }}

      const user = await userRes.json();
      return new Response(JSON.stringify({{
          connected: true,
          user: {{ login: user.login, avatar_url: user.avatar_url }}
      }}), {{
          headers: {{ 'Content-Type': 'application/json' }}
      }});

  }} catch (e) {{
      return new Response(JSON.stringify({{ connected: false, error: e.message }}), {{
        headers: {{ 'Content-Type': 'application/json' }}
    }});
  }}
}}

function handleGithubLogout() {{
    const cookie = serialize('gh_token', '', {{
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: -1
    }});

    return new Response(JSON.stringify({{ success: true }}), {{
        headers: {{
            'Content-Type': 'application/json',
            'Set-Cookie': cookie
        }}
    }});
}}

async function handleGithubRepos(request) {{
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parse(cookieHeader || "");
  const token = cookies.gh_token;

  if (!token) return new Response("Unauthorized", {{ status: 401 }});

  try {{
      const repoRes = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {{
          headers: {{
              "Authorization": `Bearer ${{token}}`,
              "User-Agent": "Nexus-AI-Worker"
          }}
      }});

      const repos = await repoRes.json();
      return new Response(JSON.stringify(repos), {{
          headers: {{ 'Content-Type': 'application/json' }}
      }});

  }} catch (e) {{
      return new Response(e.message, {{ status: 500 }});
  }}
}}

// Helper for minimal cookie parsing/serialization if 'cookie' package isn't available in standard worker env without npm
// But since we are generating the file, we should include the logic or assume it is handled.
// Wait, we can't import 'cookie' if it's not in the bundle.
// Cloudflare Workers environment usually requires bundling (esbuild/webpack) for npm packages.
// Since we are using a simple single-file generation approach, we must INLINE the cookie logic.

function parse(str) {{
  if (typeof str !== 'string') return {{}};
  var obj = {{}};
  var pairs = str.split(/; /g);
  for (var i = 0; i < pairs.length; i++) {{
    var pair = pairs[i].split('=');
    obj[pair[0]] = decodeURIComponent(pair[1]);
  }}
  return obj;
}}

function serialize(name, val, options) {{
    var opt = options || {{}};
    var enc = encodeURIComponent;
    var value = enc(val);
    var str = name + '=' + value;
    if (opt.maxAge) str += '; Max-Age=' + Math.floor(opt.maxAge);
    if (opt.domain) str += '; Domain=' + opt.domain;
    if (opt.path) str += '; Path=' + opt.path;
    if (opt.expires) str += '; Expires=' + opt.expires.toUTCString();
    if (opt.httpOnly) str += '; HttpOnly';
    if (opt.secure) str += '; Secure';
    if (opt.sameSite) {{
        var sameSite = typeof opt.sameSite === 'string' ? opt.sameSite.toLowerCase() : opt.sameSite;
        switch (sameSite) {{
            case true: str += '; SameSite=Strict'; break;
            case 'lax': str += '; SameSite=Lax'; break;
            case 'strict': str += '; SameSite=Strict'; break;
            case 'none': str += '; SameSite=None'; break;
            default: throw new TypeError('option sameSite is invalid');
        }}
    }}
    return str;
}}
"""

        with open('worker.js', 'w') as f:
            f.write(worker_script)

        print("worker.js generated successfully.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
