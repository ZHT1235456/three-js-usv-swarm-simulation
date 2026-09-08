import { plan } from "./simulation.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ result: plan(data.scene, data.kind) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
