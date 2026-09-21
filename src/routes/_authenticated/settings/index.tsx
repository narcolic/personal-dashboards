import { createFileRoute } from "@tanstack/react-router";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ProfileAvatar } from "@/components/shell/ProfileAvatar";
import { TerminalSelect } from "@/components/ui/TerminalSelect";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { supportedHomeCurrencies, useHomeCurrency, useRefreshHomeCurrency } from "@/lib/profile";
import { saveHomeCurrency, useRefreshTracker } from "@/lib/subscriptions";
import { useTheme } from "@/theme/theme-provider";

export const Route = createFileRoute("/_authenticated/settings/")({ component: ProfileSettings });

const fieldClass =
  "h-11 w-full rounded-lg border border-border/60 bg-background/40 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/20";

function ProfileSettings() {
  const { t, i18n } = useTranslation();
  const { user, loading } = useAuth();
  const homeCurrency = useHomeCurrency();
  const refreshCurrency = useRefreshHomeCurrency();
  const refreshTracker = useRefreshTracker();
  const { palette, setPalette } = useTheme();
  const [name, setName] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "el" | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (loading || !user)
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  const currentName =
    typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "";
  const currentLanguage =
    user.user_metadata?.language === "el"
      ? "el"
      : user.user_metadata?.language === "en"
        ? "en"
        : i18n.language === "el"
          ? "el"
          : "en";
  const selectedName = name ?? currentName;
  const selectedLanguage = language ?? currentLanguage;
  const selectedCurrency = currency ?? homeCurrency.data?.homeCurrency ?? "EUR";
  const hasAvatar = user.user_metadata?.avatar_path === `${user.id}/avatar`;

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      if (selectedCurrency !== homeCurrency.data?.homeCurrency) {
        await saveHomeCurrency(selectedCurrency);
        await Promise.all([refreshCurrency(), refreshTracker()]);
        window.dispatchEvent(
          new CustomEvent("profile-currency-changed", { detail: selectedCurrency }),
        );
      }
      const { error: updateError } = await supabase.auth.updateUser({
        data: { display_name: selectedName.trim(), language: selectedLanguage },
      });
      if (updateError) throw updateError;
      await i18n.changeLanguage(selectedLanguage);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("settings.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    if (!user) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError(t("settings.invalidImage"));
      return;
    }
    setImageBusy(true);
    setError(null);
    try {
      const path = `${user.id}/avatar`;
      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "60" });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_path: path, avatar_updated_at: Date.now() },
      });
      if (updateError) throw updateError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("settings.uploadFailed"));
    } finally {
      setImageBusy(false);
    }
  }

  async function removeAvatar() {
    if (!user) return;
    setImageBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_path: null, avatar_updated_at: null },
      });
      if (updateError) throw updateError;
      const { error: removeError } = await supabase.storage
        .from("profile-avatars")
        .remove([`${user.id}/avatar`]);
      if (removeError) throw removeError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("settings.removeFailed"));
    } finally {
      setImageBusy(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-7">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-bull">
          {t("settings.saved")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4 border-b border-border/40 pb-7">
        <ProfileAvatar user={user} className="size-16" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-foreground">
            {currentName || user.email}
          </p>
          {currentName && <p className="truncate text-sm text-muted-foreground">{user.email}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label
            className="cursor-pointer font-medium text-primary hover:opacity-80 focus-within:rounded-sm focus-within:outline-2 focus-within:outline-primary"
            title={t("settings.imageHint")}
          >
            {imageBusy ? t("common.loading") : t("settings.changeImage")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={imageBusy}
              onChange={(event) => void uploadAvatar(event)}
            />
          </label>
          {hasAvatar && (
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              disabled={imageBusy}
              onClick={() => void removeAvatar()}
            >
              {t("settings.removeImage")}
            </button>
          )}
        </div>
      </div>
      <form onSubmit={(event) => void save(event)} className="space-y-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm font-medium text-muted-foreground">
            <span className="mb-2 block">{t("settings.name")}</span>
            <input
              className={fieldClass}
              value={selectedName}
              onChange={(event) => {
                setName(event.target.value);
                setSaved(false);
              }}
              maxLength={120}
              placeholder={t("settings.namePlaceholder")}
            />
          </label>
          <div className="block text-sm font-medium text-muted-foreground">
            <span className="mb-2 block">{t("settings.homeCurrency")}</span>
            <TerminalSelect
              modern
              ariaLabel={t("settings.homeCurrency")}
              value={selectedCurrency}
              onChange={(value) => {
                setCurrency(value);
                setSaved(false);
              }}
              disabled={homeCurrency.isPending || homeCurrency.isError}
              options={supportedHomeCurrencies.map((code) => ({ value: code, label: code }))}
            />
          </div>
          <div className="block text-sm font-medium text-muted-foreground">
            <span className="mb-2 block">{t("settings.language")}</span>
            <TerminalSelect
              modern
              ariaLabel={t("settings.language")}
              value={selectedLanguage}
              onChange={(value) => {
                setLanguage(value as "en" | "el");
                setSaved(false);
              }}
              options={[
                { value: "en", label: "English" },
                { value: "el", label: "Ελληνικά" },
              ]}
            />
          </div>
        </div>
        {homeCurrency.isError && (
          <p role="alert" className="text-sm text-destructive">
            {homeCurrency.error.message}
          </p>
        )}
        <div className="border-t border-border/40 pt-7">
          <p className="mb-5 text-sm font-medium text-muted-foreground">
            {t("settings.colorTheme")}
          </p>
          <div
            role="group"
            aria-label={t("settings.colorTheme")}
            className="flex flex-wrap gap-x-5 gap-y-5"
          >
            {(
              [
                { value: "terminal", label: t("settings.paletteTerminal"), swatch: "bg-[#e28a2d]" },
                { value: "ocean", label: t("settings.paletteOcean"), swatch: "bg-[#49b9ed]" },
                { value: "violet", label: t("settings.paletteViolet"), swatch: "bg-[#bd8be9]" },
                { value: "emerald", label: t("settings.paletteEmerald"), swatch: "bg-[#38b997]" },
                { value: "magenta", label: t("settings.paletteMagenta"), swatch: "bg-[#d47dc4]" },
                { value: "graphite", label: t("settings.paletteGraphite"), swatch: "bg-[#929aaa]" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={palette === option.value}
                onClick={() => setPalette(option.value)}
                className={`flex min-w-16 flex-col items-center gap-3 text-xs transition-colors focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${palette === option.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-8 rounded-full ${option.swatch} ${palette === option.value ? "ring-2 ring-primary ring-offset-4 ring-offset-background" : ""}`}
                />
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={busy || homeCurrency.isPending || homeCurrency.isError}
            type="submit"
          >
            {busy ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
