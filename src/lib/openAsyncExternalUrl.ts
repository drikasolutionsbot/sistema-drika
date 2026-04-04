interface OpenAsyncExternalUrlOptions {
  blockedMessage?: string;
  loadingTitle?: string;
}

const resetBodyLocks = () => {
  if (typeof document === "undefined") return;

  document.body.style.pointerEvents = "";
  document.body.style.overflow = "";
  document.body.removeAttribute("data-scroll-locked");
};

export const openAsyncExternalUrl = async (
  resolveUrl: () => Promise<string>,
  options: OpenAsyncExternalUrlOptions = {}
) => {
  if (typeof window === "undefined") {
    throw new Error("Janela indisponível no momento.");
  }

  resetBodyLocks();

  const popup = window.open("", "_blank");

  if (!popup) {
    throw new Error(
      options.blockedMessage || "Seu navegador bloqueou a nova aba. Permita pop-ups e tente novamente."
    );
  }

  try {
    popup.opener = null;
    popup.document.title = options.loadingTitle || "Abrindo link externo...";
    popup.document.body.innerHTML = "<p style='font-family: system-ui; padding: 24px;'>Abrindo...</p>";
  } catch {
    // Ignore if the browser restricts access before navigation.
  }

  try {
    const url = await resolveUrl();
    resetBodyLocks();
    popup.location.replace(url);
    return popup;
  } catch (error) {
    try {
      popup.close();
    } catch {
      // ignore close errors
    }

    resetBodyLocks();

    if (error instanceof Error) throw error;
    throw new Error("Não foi possível abrir o link externo.");
  }
};