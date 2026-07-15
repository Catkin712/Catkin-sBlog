(() => {
    const loadUmami = async () => {
        const response = await fetch("/api/analytics/config", {
            headers: { accept: "application/json" },
        });
        if (!response.ok) {
            return;
        }

        const config = await response.json();
        if (!config.enabled || !config.websiteId || !config.scriptUrl) {
            return;
        }

        const script = document.createElement("script");
        script.defer = true;
        script.src = config.scriptUrl;
        script.dataset.websiteId = config.websiteId;
        document.head.append(script);
    };

    loadUmami().catch(() => {});
})();
