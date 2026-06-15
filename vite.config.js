import { defineConfig } from "vite";

function routeRedirects(req, res, next) {
  if (req.url === "/admin" || req.url === "/admin/") {
    res.writeHead(302, { Location: "/admin.html" });
    res.end();
    return;
  }
  const shopProduct = req.url?.match(/^\/shop\/([^/?#]+)\/?(\?.*)?$/);
  if (shopProduct) {
    res.writeHead(302, { Location: `/product.html?slug=${shopProduct[1]}` });
    res.end();
    return;
  }
  const routes = {
    "/shop": "/shop.html",
    "/shop/": "/shop.html",
    "/cart": "/cart.html",
    "/cart/": "/cart.html",
    "/checkout": "/checkout.html",
    "/checkout/": "/checkout.html",
    "/order-success": "/order-success.html",
    "/order-success/": "/order-success.html",
  };
  if (routes[req.url?.split("?")[0]]) {
    res.writeHead(302, { Location: routes[req.url.split("?")[0]] + (req.url.includes("?") ? "?" + req.url.split("?")[1] : "") });
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
      name: "route-redirects",
      configureServer(server) {
        server.middlewares.use(routeRedirects);
      },
      configurePreviewServer(server) {
        server.middlewares.use(routeRedirects);
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        admin: "admin.html",
        shop: "shop.html",
        product: "product.html",
        cart: "cart.html",
        checkout: "checkout.html",
        orderSuccess: "order-success.html",
      },
    },
  },
});
