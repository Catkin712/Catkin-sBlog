import { getPublishedPosts } from "./_shared/blog.mjs";
import { renderRssXml, xmlResponse } from "./_shared/html.mjs";

export async function onRequestGet({ env, request }) {
    try {
        const url = new URL(request.url);
        return xmlResponse(renderRssXml(await getPublishedPosts(env), url.origin));
    } catch (error) {
        return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?><error>${error.message}</error>`, 500);
    }
}
