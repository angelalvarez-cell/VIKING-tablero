import React from "react";
import { createRoot } from "react-dom/client";
import TableroViking from "./TableroViking.jsx";

const style = document.createElement("style");
style.textContent = "*{margin:0;box-sizing:border-box} html,body,#root{height:100%}";
document.head.appendChild(style);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TableroViking />
  </React.StrictMode>
);
