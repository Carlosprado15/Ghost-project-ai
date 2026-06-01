
import { GhostModal } from "./ghost-modal";
import { GhostConfig } from "./ghost-config";

export const GhostEmbed = {
  init: (config) => {
    Object.assign(GhostConfig, config);
  },
  open: (options) => {
    const queryParams = new URLSearchParams();
    if (options.productId) queryParams.append("productId", options.productId);
    if (options.imageUrl) queryParams.append("imageUrl", options.imageUrl);
    if (options.productUrl) queryParams.append("productUrl", options.productUrl);
    const queryString = queryParams.toString();
    GhostModal.open(`${GhostConfig.productUrl}?${queryString}`);
  },
  close: () => {
    GhostModal.close();
  },
};
