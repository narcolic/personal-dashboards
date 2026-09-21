import {
  siAppletv,
  siBitdefender,
  siF1,
  siGoogle,
  siHbomax,
  siNetflix,
  siPerplexity,
  siProton,
  siRevolut,
  siSpotify,
  siYoutube,
  type SimpleIcon,
} from "simple-icons";

export type SubscriptionLogoOption = {
  key: string;
  label: string;
  icon?: SimpleIcon;
  initials?: string;
  color?: string;
  special?: "microsoft" | "nintendo" | "amazon";
  generic?: "play" | "music" | "cloud" | "software" | "game" | "shield" | "other";
};

// The named options mirror the services in the supplied subscription screenshot.
// A styled mark stands in for services without a bundled brand symbol.
export const serviceLogos: SubscriptionLogoOption[] = [
  { key: "youtube", label: "YouTube Premium", icon: siYoutube },
  { key: "spotify", label: "Spotify", icon: siSpotify },
  { key: "chatgpt", label: "ChatGPT Plus", initials: "AI", color: "#10A37F" },
  { key: "torbox", label: "Torbox", initials: "TB", color: "#E69A35" },
  { key: "netflix", label: "Netflix", icon: siNetflix },
  { key: "skroutz", label: "Skroutz Plus", initials: "S+", color: "#6ABF55" },
  { key: "appletv", label: "Apple TV+", icon: siAppletv, color: "currentColor" },
  { key: "perplexity", label: "Perplexity AI Pro", icon: siPerplexity },
  { key: "tapo", label: "Tapo Care", initials: "T", color: "#49A6F6" },
  { key: "protonpass", label: "Proton Pass", icon: siProton },
  { key: "hbomax", label: "HBO Max", icon: siHbomax, color: "currentColor" },
  { key: "revolut", label: "Revolut", icon: siRevolut, color: "currentColor" },
  { key: "amazonprime", label: "Amazon Prime", special: "amazon" },
  { key: "googleone", label: "Google One", icon: siGoogle },
  { key: "tvseriesguide", label: "TV Series Guide", initials: "TV", color: "#7868E6" },
  { key: "aiwasim", label: "Aiwa SIM", initials: "A", color: "#14B8A6" },
  { key: "nintendoswitch", label: "Nintendo Switch Online", special: "nintendo" },
  { key: "f1tv", label: "F1 TV", icon: siF1 },
  { key: "planesim", label: "Planesim", initials: "PS", color: "#68B26A" },
  { key: "disneyplus", label: "Disney+", initials: "D+", color: "#4E8EED" },
  { key: "microsoftoffice", label: "Microsoft Office", special: "microsoft" },
  { key: "bitdefender", label: "Bitdefender", icon: siBitdefender },
];

export const genericLogos: SubscriptionLogoOption[] = [
  { key: "generic-streaming", label: "Streaming", generic: "play" },
  { key: "generic-music", label: "Music", generic: "music" },
  { key: "generic-cloud", label: "Cloud", generic: "cloud" },
  { key: "generic-software", label: "Software", generic: "software" },
  { key: "generic-gaming", label: "Gaming", generic: "game" },
  { key: "generic-security", label: "Security", generic: "shield" },
  { key: "generic-other", label: "Other", generic: "other" },
];

export const subscriptionLogoByKey = new Map(
  [...serviceLogos, ...genericLogos].map((option) => [option.key, option]),
);
