const UPSTREAM_OWNER = "ajayk134";
const UPSTREAM_REPO = "exam-data";
const UPSTREAM_BRANCH = "masked_main";

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Exam-Password",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, "");
    const parts = path.split("/").filter(Boolean);

    const isProtected =
      (parts.length === 1 && parts[0] === "index") ||
      (parts.length === 2 && parts[1] === "exams");

    if (isProtected) {
      const providedAuth = (
        request.headers.get("X-Exam-Password") ||
        url.searchParams.get("pw") ||
        ""
      ).trim();

      const expectedPassword = env.EXAM_PASSWORD;

      if (!expectedPassword) {
        return new Response("Server misconfigured.", {
          status: 500,
          headers: corsHeaders
        });
      }

      if (providedAuth !== expectedPassword) {
        return new Response("Unauthorized.", {
          status: 401,
          headers: corsHeaders
        });
      }
    }

    let githubPath = "";

    if (parts.length === 1 && parts[0] === "index") {
      githubPath = "data/index.json";
    } else if (parts.length === 2 && parts[1] === "exams") {
      githubPath = `data/${parts[0]}/exams.json`;
    } else if (parts.length === 2) {
      githubPath = `data/${parts[0]}/${parts[1]}.json`;
    } else {
      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders
      });
    }

    if (!env.GITHUB_TOKEN) {
      return new Response("Server misconfigured.", {
        status: 500,
        headers: corsHeaders
      });
    }

    const githubUrl = `https://raw.githubusercontent.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/${UPSTREAM_BRANCH}/${githubPath}`;

    const res = await fetch(githubUrl, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "User-Agent": "cf-worker"
      }
    });

    if (!res.ok) {
      return new Response("Data not found", {
        status: 404,
        headers: corsHeaders
      });
    }

    return new Response(res.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      }
    });
  }
};
