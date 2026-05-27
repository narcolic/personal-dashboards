export type DashboardItem = {
  titleKey: string;
  path: string | null;
  descriptionKey: string;
  placeholder?: boolean;
};

export type DashboardCategory = {
  categoryKey: string;
  items: DashboardItem[];
};

export const dashboardCategories: DashboardCategory[] = [
  {
    categoryKey: "dashboards.finance",
    items: [
      {
        titleKey: "dashboards.portfolioTitle",
        path: "/portfolio",
        descriptionKey: "dashboards.portfolioDescription",
      },
      {
        titleKey: "dashboards.carServiceTitle",
        path: "/car-service",
        descriptionKey: "dashboards.carServiceDescription",
      },
      {
        titleKey: "dashboards.energyTitle",
        path: null,
        descriptionKey: "dashboards.energyDescription",
        placeholder: true,
      },
    ],
  },
];

export const dashboards = dashboardCategories.flatMap((group) => group.items);
