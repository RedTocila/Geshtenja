import { defineConfig } from "vite";

function adminRedirect(req, res, next) {
  if (req.url === "/admin" || req.url === "/admin/") {
    res.writeHead(302, { Location: "/admin.html" });
    res.end();
    return;
  }
  next();
}

export default defineConfig({
  server: {
    port: 5173,
    open: true,
  },
  plugins: [
    {
      name: "admin-redirect",
      configureServer(server) {
        server.middlewares.use(adminRedirect);
      },
      configurePreviewServer(server) {
        server.middlewares.use(adminRedirect);
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        admin: "admin.html",
      },
    },
  },
});
