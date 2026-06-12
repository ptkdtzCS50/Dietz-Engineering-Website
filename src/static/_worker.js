export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "engineering-dietz.com") {
      url.hostname = "www.engineering-dietz.com";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
