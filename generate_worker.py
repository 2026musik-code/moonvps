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

async function handleListChats(env) {{
  if (!env.BUCKET) {{
    return new Response(JSON.stringify({{ error: 'R2 Bucket not configured' }}), {{ status: 500 }});
  }}

  try {{
    // List objects in the bucket
    // Note: listing returns keys, we might need metadata (title)
    // To keep it simple: we list keys.
    // For a real app, we might store a 'index.json' or store metadata on objects.
    // Let's assume we list all objects.

    const list = await env.BUCKET.list();
    const chats = [];

    // Limit to prevent too many reads if bucket is huge (pagination needed in prod)
    for (const obj of list.objects) {{
        // Ideally we shouldn't read every object body just to get the title.
        // A better design is storing metadata in customMetadata.
        // Let's check customMetadata first.
        // If not present, we might have to read body (slow) or just show ID.
        // NOTE: env.BUCKET.list() returns objects with 'customMetadata' if available.

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

    // Save to R2
    // We store the title in customMetadata for listing efficiency
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
"""

        with open('worker.js', 'w') as f:
            f.write(worker_script)

        print("worker.js generated successfully.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
