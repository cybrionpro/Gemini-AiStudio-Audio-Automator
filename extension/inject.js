(function() {
    console.log("[Extension Inject] Fetch interceptor active.");

    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0];
        
        if (typeof url === 'string' && url.includes('GenerateContent')) {
            console.log("[Extension Inject] Intercepted GenerateContent request:", url);
            
            try {
                const response = await originalFetch.apply(this, args);
                
                const clone = response.clone();
                const text = await clone.text();
                
                window.postMessage({
                    source: "aistudio-tts-interceptor",
                    type: "generate-content-response",
                    data: text
                }, "*");
                
                return response;
            } catch (err) {
                console.error("[Extension Inject] Error in intercepted fetch:", err);
                return originalFetch.apply(this, args);
            }
        }
        
        return originalFetch.apply(this, args);
    };
})();
