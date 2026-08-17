import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Vue example root element #app was not found.");
}

createApp(App).mount(rootElement);
