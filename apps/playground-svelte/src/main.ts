import { mount } from "svelte";
import App from "./App.svelte";
import "./styles.css";

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Svelte example root element #app was not found.");
}

const app = mount(App, { target: rootElement });

export default app;
