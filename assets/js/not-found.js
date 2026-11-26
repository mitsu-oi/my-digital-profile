// Сторінка 404: показує адресу, яку відкрив користувач.
// Лише textContent: адреса приходить із рядка браузера, тож її не можна вставляти як HTML.
const path = document.querySelector('[data-nf-path]');

if (path) {
  let address = location.pathname;
  try {
    address = decodeURIComponent(address);
  } catch {
    // зламане %-кодування: показуємо адресу як є
  }
  path.textContent = address.length > 80 ? `${address.slice(0, 77)}…` : address;
}
