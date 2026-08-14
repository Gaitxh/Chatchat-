(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  function check() {
    const root = document.documentElement;
    const receipt = document.querySelector(".consultation-receipt");
    const preview = receipt?.querySelector(".receipt-card-preview");
    const actions = receipt ? [...receipt.querySelectorAll(".receipt-actions button")] : [];
    if (!receipt || !preview || actions.length < 2) return;
    root.dataset.chatchatConsultationReceiptShowcase = "complete";
    observer.disconnect();
  }

  const observer = new MutationObserver(check);
  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });
  window.addEventListener("DOMContentLoaded", check, { once: true });
  check();
})();
