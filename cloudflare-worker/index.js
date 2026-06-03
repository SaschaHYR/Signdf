export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "PUT, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "PUT") {
      return new Response("Method not allowed", { status: 405 });
    }

    // key = pdfs/{token}/original.pdf or pdfs/{token}/signed.pdf
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // strip leading /

    if (!key.startsWith("pdfs/")) {
      return new Response("Forbidden", { status: 403 });
    }

    await env.BUCKET.put(key, request.body, {
      httpMetadata: { contentType: "application/pdf" },
    });

    const publicUrl = `${env.R2_PUBLIC_URL}/${key}`;

    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
