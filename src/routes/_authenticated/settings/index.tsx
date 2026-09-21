import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { ProfileAvatar } from "@/components/shell/ProfileAvatar";
import { TerminalSelect } from "@/components/ui/TerminalSelect";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { supportedHomeCurrencies, useHomeCurrency, useRefreshHomeCurrency } from "@/lib/profile";
import { saveHomeCurrency, useRefreshTracker } from "@/lib/subscriptions";
import { useTheme } from "@/theme/theme-provider";
import { buttonClass, inputClass, secondaryButtonClass } from "../subscriptions/components";

export const Route = createFileRoute("/_authenticated/settings/")({ component: ProfileSettings });

function ProfileSettings() {
  const { t, i18n } = useTranslation();
  const { user, loading } = useAuth();
  const router = useRouter();
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
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

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

  async function signOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const { error: authError } = await supabase.auth.signOut();
      if (authError) throw authError;
      await router.navigate({ to: "/login" });
    } catch (cause) {
      setSignOutError(cause instanceof Error ? cause.message : t("settings.signOutFailed"));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-emerald-400">
          {t("settings.saved")}
        </p>
      )}
      <TerminalCard bodyClassName="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/50 pb-5">
          <ProfileAvatar user={user} className="size-14" />
          <div className="min-w-0 flex-1">
            {currentName && (
              <p className="truncate text-sm font-semibold text-foreground">{currentName}</p>
            )}
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`${secondaryButtonClass} cursor-pointer`}
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
                className={secondaryButtonClass}
                disabled={imageBusy}
                onClick={() => void removeAvatar()}
              >
                {t("settings.removeImage")}
              </button>
            )}
          </div>
        </div>
        <form onSubmit={(event) => void save(event)} className="space-y-5 pt-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-xs uppercase tracking-wider text-muted-foreground">
              <span className="mb-1.5 block">{t("settings.name")}</span>
              <input
                className={inputClass}
                value={selectedName}
                onChange={(event) => {
                  setName(event.target.value);
                  setSaved(false);
                }}
                maxLength={120}
                placeholder={t("settings.namePlaceholder")}
              />
            </label>
            <div className="block text-xs uppercase tracking-wider text-muted-foreground">
              <span className="mb-1.5 block">{t("settings.homeCurrency")}</span>
              <TerminalSelect
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
            <div className="block text-xs uppercase tracking-wider text-muted-foreground">
              <span className="mb-1.5 block">{t("settings.language")}</span>
              <TerminalSelect
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
          <div className="border-t border-border/50 pt-5">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              {t("settings.colorTheme")}
            </p>
            <div
              role="group"
              aria-label={t("settings.colorTheme")}
              className="flex flex-wrap gap-2"
            >
              {(
                [
                  {
                    value: "terminal",
                    label: t("settings.paletteTerminal"),
                    swatch: "bg-[#e28a2d]",
                  },
                  { value: "ocean", label: t("settings.paletteOcean"), swatch: "bg-[#49b9ed]" },
                  { value: "violet", label: t("settings.paletteViolet"), swatch: "bg-[#bd8be9]" },
                  {
                    value: "emerald",
                    label: t("settings.paletteEmerald"),
                    swatch: "bg-[#38b997]",
                  },
                  {
                    value: "magenta",
                    label: t("settings.paletteMagenta"),
                    swatch: "bg-[#d47dc4]",
                  },
                  {
                    value: "graphite",
                    label: t("settings.paletteGraphite"),
                    swatch: "bg-[#929aaa]",
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={palette === option.value}
                  onClick={() => setPalette(option.value)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    palette === option.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  <span aria-hidden="true" className={`size-3 rounded-full ${option.swatch}`} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end border-t border-border/50 pt-4">
            <button
              className={buttonClass}
              disabled={busy || homeCurrency.isPending || homeCurrency.isError}
              type="submit"
            >
              {busy ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </form>
      </TerminalCard>
      <div className="flex flex-col items-end gap-2 pt-2">
        <button
          type="button"
          disabled={signingOut}
          onClick={() => void signOut()}
          className="inline-flex min-h-9 items-center justify-center rounded-md border border-border px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        >
          {signingOut ? t("common.loading") : t("settings.signOut")}
        </button>
        {signOutError && (
          <p role="alert" className="text-sm text-destructive">
            {signOutError}
          </p>
        )}
      </div>
    </div>
  );
}
