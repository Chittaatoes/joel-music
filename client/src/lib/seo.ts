import { useEffect } from "react";

const BASE_URL = "https://joel-music.vercel.app";

function setMetaByName(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaByProperty(property: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

export type PageMeta = {
  title: string;
  description: string;
  path?: string;
};

export function usePageMeta({ title, description, path = "/" }: PageMeta) {
  useEffect(() => {
    const fullUrl = `${BASE_URL}${path}`;
    document.title = title;
    setMetaByName("description", description);
    setMetaByProperty("og:title", title);
    setMetaByProperty("og:description", description);
    setMetaByProperty("og:url", fullUrl);
    setMetaByName("twitter:title", title);
    setMetaByName("twitter:description", description);
    setCanonical(fullUrl);
  }, [title, description, path]);
}
