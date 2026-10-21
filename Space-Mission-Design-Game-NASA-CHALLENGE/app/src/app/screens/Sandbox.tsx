import { useEffect, useState } from "react";
import { sandbox } from "../../legacy";
import { useGame } from "../../game/store";
import { Icon } from "../ui";

/** Slim header for the free-play simulators. */
export function SandboxBar() {
  const { go, screen } = useGame();
  const [, setSub] = useState(sandbox.sub);
  useEffect(() => sandbox.onChange(setSub), []);
  return (
    <header className="topbar slim">
      <button className="brandbtn" onClick={() => go("menu")}><Icon name="back" /><span className="brand-t"><b>Menú principal</b><small>Simuladores libres</small></span></button>
      <nav className="mainnav">
        <button className={screen === "explore" ? "on" : ""} onClick={() => (screen === "explore" ? sandbox.open("solar") : go("explore"))}><Icon name="globe" /><span>Sistema solar</span></button>
        <button className={screen === "orbit" ? "on" : ""} onClick={() => go("orbit")}><Icon name="orbit" /><span>Órbita terrestre</span></button>
      </nav>
    </header>
  );
}
