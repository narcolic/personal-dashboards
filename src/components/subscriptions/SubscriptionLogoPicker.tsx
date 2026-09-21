import { useState } from "react";
import { useTranslation } from "react-i18next";
import { genericLogos, serviceLogos, type SubscriptionLogoOption } from "@/lib/subscription-logos";
import { SubscriptionLogo } from "./SubscriptionLogo";

export function SubscriptionLogoPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const selected = [...serviceLogos, ...genericLogos].find((option) => option.key === value);
  const labelFor = (option: SubscriptionLogoOption) =>
    option.generic ? t(`subscriptions.logoGeneric.${option.generic}`) : option.label;
  const matches = (option: SubscriptionLogoOption) =>
    [option.label, labelFor(option)].some((label) =>
      label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    );
  const services = serviceLogos.filter(matches);
  const generic = genericLogos.filter(matches);

  return (
    <fieldset className="mt-5 border-t border-border/60 pt-4">
      <legend className="text-xs uppercase tracking-wider text-muted-foreground">
        {t("subscriptions.logoOptional")}
      </legend>
      <details className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <SubscriptionLogo logoKey={value} name={name} />
          <span className="min-w-0 flex-1 text-sm text-foreground">
            {selected ? labelFor(selected) : t("subscriptions.defaultIcon")}
          </span>
          <span className="text-xs text-primary group-open:rotate-90">▸</span>
        </summary>
        <div className="mt-3 space-y-4">
          <input
            type="search"
            className="h-10 w-full rounded-md border border-border bg-background/70 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={t("subscriptions.findLogo")}
            aria-label={t("subscriptions.findLogo")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {!search.trim() && (
            <LogoChoice
              label={t("subscriptions.defaultIcon")}
              logoKey={null}
              name={name}
              selected={value === null}
              onClick={() => onChange(null)}
            />
          )}
          {services.length > 0 && (
            <LogoGroup
              label={t("subscriptions.serviceLogos")}
              options={services}
              labelFor={labelFor}
              selectedKey={value}
              onChange={onChange}
            />
          )}
          {generic.length > 0 && (
            <LogoGroup
              label={t("subscriptions.genericIcons")}
              options={generic}
              labelFor={labelFor}
              selectedKey={value}
              onChange={onChange}
            />
          )}
          {services.length === 0 && generic.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("subscriptions.noMatchingLogos")}</p>
          )}
        </div>
      </details>
    </fieldset>
  );
}

function LogoGroup({
  label,
  options,
  labelFor,
  selectedKey,
  onChange,
}: {
  label: string;
  options: SubscriptionLogoOption[];
  labelFor: (option: SubscriptionLogoOption) => string;
  selectedKey: string | null;
  onChange: (key: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <LogoChoice
            key={option.key}
            label={labelFor(option)}
            logoKey={option.key}
            name={option.label}
            selected={selectedKey === option.key}
            onClick={() => onChange(option.key)}
          />
        ))}
      </div>
    </div>
  );
}

function LogoChoice({
  label,
  logoKey,
  name,
  selected,
  onClick,
}: {
  label: string;
  logoKey: string | null;
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-w-0 items-center gap-2 rounded-md border p-2 text-left text-sm transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        selected
          ? "border-primary/70 bg-primary/10 text-foreground"
          : "border-border/60 text-muted-foreground"
      }`}
    >
      <SubscriptionLogo logoKey={logoKey} name={name} size="sm" />
      <span className="truncate">{label}</span>
    </button>
  );
}
