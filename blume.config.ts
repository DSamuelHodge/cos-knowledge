import { defineConfig } from "blume";
import { z } from "zod";

export default defineConfig({
  title: "CoS Knowledge",
  description:
    "Derrick Hodge — unified personal & professional knowledge base. Briefs, projects, workflows, decisions, commitments, people, and life operations.",
  content: {
    root: "docs",
  },
  deployment: {
    output: "static",
    site: "https://cos.hodgederrick.com",
  },
  github: {
    owner: "DSamuelHodge",
    repo: "cos-knowledge",
  },
  theme: {
    accent: "blue",
    mode: "system",
  },
  search: {
    provider: "orama",
  },
  navigation: {
    sidebar: {
      display: "group",
    },
    tabs: [
      { label: "Home", path: "/", icon: "home" },
      { label: "Personal", path: "/personal", icon: "book-open" },
      { label: "Professional", path: "/professional", icon: "rocket" },
    ],
  },
  ai: {
    llmsTxt: true,
  },
  seo: {
    sitemap: true,
    robots: true,
    og: { enabled: true },
    structuredData: true,
  },
  frontmatter: {
    extend: {
      // Knowledge-graph contract: every page carries these keys.
      // (`type` is a Blume built-in — set it in page frontmatter; values are
      // the CoS types: section/person/project/decision/briefing/workflow/
      // commitment/goal/routine/note)
      id: z.string(),
      category: z.enum(["personal", "professional"]).optional(),
      status: z.enum(["draft", "current", "archive"]).optional(),
      updated: z.coerce.date().optional(),
      tags: z.array(z.string()).optional(),
      tools: z.array(z.string()).optional(),
    },
  },
});