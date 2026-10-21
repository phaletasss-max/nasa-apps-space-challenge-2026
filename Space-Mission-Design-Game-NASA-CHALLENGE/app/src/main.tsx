import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import "./app/game.css";
import "./engine";
import { App } from "./app/App";
import { useGame } from "./game/store";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
if (import.meta.env.DEV) Object.assign(window, { __game: useGame }); // console debugging only
