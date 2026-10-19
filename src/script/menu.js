
const menu = document.querySelector('.menu');

menu?.addEventListener('click', () => {
    const isExpanded = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', `${!isExpanded}`);
});

document.querySelectorAll(".nav-group-toggle").forEach((button) => {
    button.addEventListener("click", () => {
        const group = button.closest(".nav-group");
        const isExpanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", `${!isExpanded}`);
        group?.classList.toggle("open", !isExpanded);
    });
});
