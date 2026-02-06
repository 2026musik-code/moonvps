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

    // --- API Routes ---

    // Auth
    if (path === '/api/auth/login') {{
      return await handleLogin(request, env);
    }}

    // Admin
    if (path === '/api/admin/keys') {{
      return await handleAdminKeys(request, env);
    }} else if (path === '/api/admin/change-password') {{
      return await handleAdminPassword(request, env);
    }}

    // User
    if (path === '/api/user/status') {{
        return await handleUserStatus(request, env);
    }} else if (path === '/api/user/usage') {{
        return await handleUserUsage(request, env);
    }}

    // Chats (Protected)
    if (path === '/api/chats') {{
      return await handleListChats(request, env);
    }} else if (path === '/api/chat') {{
      if (request.method === 'GET') {{
        return await handleGetChat(request, env);
      }} else if (request.method === 'POST') {{
        return await handleSaveChat(request, env);
      }}
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

// --- Helper Functions ---

function jsonResp(data, status = 200) {{
    return new Response(JSON.stringify(data), {{
        status,
        headers: {{ 'Content-Type': 'application/json' }}
    }});
}}

async function getAdminConfig(env) {{
    const obj = await env.BUCKET.get('admin.json');
    if (!obj) {{
        // Init default
        const def = {{ password: 'nina131@' }};
        await env.BUCKET.put('admin.json', JSON.stringify(def));
        return def;
    }}
    return await obj.json();
}}

async function getUsersDB(env) {{
    const obj = await env.BUCKET.get('users.json');
    if (!obj) return {{}};
    return await obj.json();
}}

async function saveUsersDB(env, data) {{
    await env.BUCKET.put('users.json', JSON.stringify(data));
}}

async function verifyKey(request, env) {{
    // Extract key from header or query or body
    // Simplified: passing key in body for most actions, query for GET
    // Or Authorization Header: Bearer <key>
    const auth = request.headers.get('Authorization');
    if (!auth) return null;
    const key = auth.replace('Bearer ', '').trim();

    // Check Admin
    const admin = await getAdminConfig(env);
    if (key === admin.password) return {{ role: 'admin', key: 'admin' }};

    // Check User
    const users = await getUsersDB(env);
    if (users[key]) return {{ role: 'user', key: key, data: users[key] }};

    return null;
}}

// --- Handlers ---

async function handleLogin(req, env) {{
    try {{
        const body = await req.json();
        const key = body.key;

        const admin = await getAdminConfig(env);
        if (key === admin.password) {{
            return jsonResp({{ role: 'admin' }});
        }}

        const users = await getUsersDB(env);
        if (users[key]) {{
            return jsonResp({{
                role: 'user',
                quota: users[key].quota,
                used: users[key].used
            }});
        }}

        return jsonResp({{ error: 'Invalid Credentials' }}, 401);
    }} catch (e) {{ return jsonResp({{ error: e.message }}, 500); }}
}}

async function handleAdminKeys(req, env) {{
    const auth = await verifyKey(req, env);
    if (!auth || auth.role !== 'admin') return jsonResp({{ error: 'Unauthorized' }}, 403);

    const users = await getUsersDB(env);

    if (req.method === 'GET') {{
        const list = Object.keys(users).map(k => ({{ key: k, ...users[k] }}));
        return jsonResp({{ keys: list }});
    }}

    if (req.method === 'POST') {{
        const body = await req.json();
        if (!body.key) return jsonResp({{ error: 'Missing key name' }}, 400);

        // Create or Update
        const target = users[body.key] || {{ created: Date.now(), used: 0 }};
        if (body.quota !== undefined) target.quota = body.quota;
        if (body.used !== undefined) target.used = body.used; // Allow reset

        users[body.key] = target;
        await saveUsersDB(env, users);
        return jsonResp({{ success: true }});
    }}

    if (req.method === 'DELETE') {{
        const body = await req.json();
        if (users[body.key]) {{
            delete users[body.key];
            await saveUsersDB(env, users);
        }}
        return jsonResp({{ success: true }});
    }}
}}

async function handleAdminPassword(req, env) {{
    const auth = await verifyKey(req, env);
    if (!auth || auth.role !== 'admin') return jsonResp({{ error: 'Unauthorized' }}, 403);

    const body = await req.json();
    if (!body.password) return jsonResp({{ error: 'Missing password' }}, 400);

    await env.BUCKET.put('admin.json', JSON.stringify({{ password: body.password }}));
    return jsonResp({{ success: true }});
}}

async function handleUserStatus(req, env) {{
    const body = await req.json(); // key in body for convenience
    const key = body.key;
    const users = await getUsersDB(env);

    if (users[key]) {{
        return jsonResp({{ quota: users[key].quota, used: users[key].used }});
    }}
    return jsonResp({{ error: 'Invalid key' }}, 401);
}}

async function handleUserUsage(req, env) {{
    const body = await req.json();
    const key = body.key;
    const users = await getUsersDB(env);

    if (users[key]) {{
        if (users[key].used >= users[key].quota) {{
            return jsonResp({{ error: 'Quota exceeded' }}, 403);
        }}
        users[key].used = (users[key].used || 0) + 1;
        await saveUsersDB(env, users);
        return jsonResp({{ success: true, used: users[key].used, quota: users[key].quota }});
    }}
    return jsonResp({{ error: 'Invalid key' }}, 401);
}}

// Chat handlers adapted for Auth
async function handleListChats(req, env) {{
    const url = new URL(req.url);
    const key = url.searchParams.get('key');

    // Auth check simplified: verify against DB or Admin
    const admin = await getAdminConfig(env);
    let prefix = '';

    if (key === admin.password) {{
        // Admin sees all? Or admin has own space?
        // Let's say Admin sees everything or just 'admin/' prefix.
        // For simplicity, Admin is just another user effectively for chat storage currently,
        // OR we prefix user chats with their key to separate them.
        // CURRENT IMPLEMENTATION: Shared bucket.
        // FIX: Prefix keys with user key.
        // For backward compatibility with existing "No Auth" chats, we might have issues.
        // Let's assume we start fresh or migration not needed for demo.
        // We will prefix objects with `${{key}}/`.
        prefix = key + '/';
    }} else {{
        const users = await getUsersDB(env);
        if (!users[key]) return jsonResp({{ error: 'Unauthorized' }}, 401);
        prefix = key + '/';
    }}

    const list = await env.BUCKET.list({{ prefix: prefix }});
    const chats = [];

    for (const obj of list.objects) {{
        let title = 'Chat';
        if (obj.customMetadata && obj.customMetadata.title) {{
            title = obj.customMetadata.title;
        }}

        // ID returned to frontend should strip prefix or keep it?
        // Keep it to be safe for GET.
        chats.push({{
            id: obj.key,
            title: title,
            uploaded: obj.uploaded
        }});
    }}

    return jsonResp({{ chats }});
}}

async function handleGetChat(req, env) {{
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const key = url.searchParams.get('key');

    // Basic Auth Check
    const admin = await getAdminConfig(env);
    const users = await getUsersDB(env);
    if (key !== admin.password && !users[key]) return jsonResp({{ error: 'Unauthorized' }}, 401);

    // Access Control: Ensure ID starts with Key (User Isolation)
    if (!id.startsWith(key + '/')) return jsonResp({{ error: 'Access Denied' }}, 403);

    const object = await env.BUCKET.get(id);
    if (!object) return new Response('Not Found', {{ status: 404 }});

    return new Response(object.body, {{ headers: {{ 'Content-Type': 'application/json' }} }});
}}

async function handleSaveChat(req, env) {{
    const body = await req.json();
    const key = body.key;

    // Auth
    const admin = await getAdminConfig(env);
    const users = await getUsersDB(env);
    if (key !== admin.password && !users[key]) return jsonResp({{ error: 'Unauthorized' }}, 401);

    // Check ID prefix
    let id = body.id;
    if (!id.startsWith(key + '/')) {{
        // If coming from old client or fresh ID, prefix it
        // If ID is just UUID, prepend.
        // If ID is already prefixed (update), verify.
        if (id.includes('/')) {{
             return jsonResp({{ error: 'Invalid ID path' }}, 400);
        }}
        id = key + '/' + id;
    }}

    const title = body.title || 'Untitled';
    await env.BUCKET.put(id, JSON.stringify(body), {{ customMetadata: {{ title }} }});
    return jsonResp({{ success: true }});
}}
"""

        with open('worker.js', 'w') as f:
            f.write(worker_script)

        print("worker.js generated successfully.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
