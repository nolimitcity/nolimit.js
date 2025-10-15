// 1. Load the flobby config file
// 2. load in the flobby (css, js etc)
// 3. Create the flobby launch button
// 4. Add flobby iframe

export const getFlobbyConfig = async () => {
    const url = 'https://api.restful-api.dev/objects';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const result = await response.json();
        console.log('res:', result);
    } catch (error) {
        console.error(error.message);
    }
};


export const initFlobby = () => {
    getFlobbyConfig().then(() => {
        console.log('Flobby Config Loaded');
    });

    console.log('initFlobby');
};