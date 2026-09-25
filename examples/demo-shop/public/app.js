let addressEdited = false;
const form = document.querySelector("form");
const edit = document.querySelector('[data-testid="edit-address"]');
const checkout = document.querySelector('[data-testid="checkout"]');
const error = document.querySelector("#error");

if (location.pathname === "/checkout") {
  document.querySelector("#cart").hidden = true;
  document.querySelector("#success").hidden = false;
}

edit.addEventListener("click", () => {
  form.hidden = false;
  edit.hidden = true;
  document.querySelector("#postal-code").focus();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector("#saved-postal").textContent =
    document.querySelector("#postal-code").value;
  addressEdited = true;
  form.hidden = true;
  edit.hidden = false;
});
checkout.addEventListener("click", async () => {
  checkout.disabled = true;
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressEdited }),
    });
    if (!response.ok) {
      error.textContent =
        "Impossible de continuer : le code postal a été perdu après la modification de l’adresse.";
      error.hidden = false;
      console.error("ADDRESS_POSTAL_CODE_MISSING");
      return;
    }
    location.assign("/checkout");
  } catch {
    error.textContent = "La boutique locale est inaccessible.";
    error.hidden = false;
  } finally {
    checkout.disabled = false;
  }
});
