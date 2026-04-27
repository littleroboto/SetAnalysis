// Landing-page footer: a low-key bill of materials.
//
// The "Latest" stamp is populated from build-time git constants baked in
// by `vite.config.ts` (`define`). Dev server: refreshed on each restart;
// production: refreshed on each `vite build`. We render `<short-sha> ·
// <subject> · <relative-time>`. In demo mode (`?demo=1`) the SHA chip
// links to the commit on GitHub and any `github.com` links elsewhere in
// the footer are kept; outside demo mode we render the SHA as plain text
// and strip GitHub-pointing anchors so the public landing doesn't
// actively invite traffic into the source repo.

const REPO_COMMIT_BASE = "https://github.com/littleroboto/SetAnalysis/commit/";

/** Truncate a commit subject so the footer stays on a sensible width. */
const SUBJECT_MAX_CH = 72;

interface FooterOptions {
  /** When false, GitHub links in the footer are demoted to plain text. */
  demoMode: boolean;
}

/**
 * Fill in `#landing-footer-commit` and gate any `github.com` links in
 * `.landing-footer` on `demoMode`. No-op if either the host element is
 * missing (workbench view) or git constants weren't injected (e.g.
 * unknown sha from a tarball install).
 */
export function initLandingFooter(opts: FooterOptions = { demoMode: false }): void {
  if (!opts.demoMode) {
    demoteGithubLinks();
  }

  const host = document.getElementById("landing-footer-commit");
  if (!host) return;

  const sha = (typeof __GIT_SHA__ === "string" ? __GIT_SHA__ : "").trim();
  const subject = (typeof __GIT_SUBJECT__ === "string" ? __GIT_SUBJECT__ : "").trim();
  const isoDate = (typeof __GIT_DATE__ === "string" ? __GIT_DATE__ : "").trim();

  if (!sha || sha === "unknown") {
    host.textContent = "(unknown commit)";
    return;
  }

  // SHA chip: a real link in demo mode, a plain code chip otherwise.
  const shaCode = document.createElement("code");
  shaCode.textContent = sha;
  if (opts.demoMode) {
    const shaLink = document.createElement("a");
    shaLink.href = `${REPO_COMMIT_BASE}${sha}`;
    shaLink.target = "_blank";
    shaLink.rel = "noopener noreferrer";
    shaLink.appendChild(shaCode);
    host.replaceChildren(shaLink);
  } else {
    host.replaceChildren(shaCode);
  }

  if (subject) {
    host.append(" \u00b7 ");
    const subjectSpan = document.createElement("span");
    subjectSpan.className = "landing-footer-commit-subject";
    subjectSpan.textContent = truncate(subject, SUBJECT_MAX_CH);
    subjectSpan.title = subject;
    host.appendChild(subjectSpan);
  }

  if (isoDate) {
    host.append(" \u00b7 ");
    const time = document.createElement("time");
    time.dateTime = isoDate;
    const parsed = new Date(isoDate);
    const rel = Number.isFinite(parsed.getTime())
      ? formatRelative(parsed, new Date())
      : isoDate;
    time.textContent = rel;
    time.title = parsed.toLocaleString();
    host.appendChild(time);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}\u2026`;
}

/**
 * Convert any `github.com` anchor inside `.landing-footer` into a plain
 * `<span>` carrying the same text. We do this in JS rather than CSS so
 * the link href can't leak via copy-link / right-click / hover preview.
 */
function demoteGithubLinks(): void {
  const footer = document.querySelector(".landing-footer");
  if (!footer) return;
  const anchors = footer.querySelectorAll<HTMLAnchorElement>(
    "a[href*='github.com']",
  );
  for (const a of anchors) {
    const span = document.createElement("span");
    span.className = a.className;
    span.append(...Array.from(a.childNodes));
    a.replaceWith(span);
  }
}

/**
 * "5 minutes ago" / "2 days ago". Falls back to a yyyy-mm-dd date if the
 * gap exceeds 30 days, which reads cleaner for older commits than
 * "3 months ago" precision we don't really need on a landing page.
 */
function formatRelative(date: Date, now: Date): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "";

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(seconds);

  if (abs < 60) return rtf.format(-Math.round(seconds), "second");
  if (abs < 60 * 60) return rtf.format(-Math.round(seconds / 60), "minute");
  if (abs < 60 * 60 * 24) return rtf.format(-Math.round(seconds / 3600), "hour");
  if (abs < 60 * 60 * 24 * 30)
    return rtf.format(-Math.round(seconds / (60 * 60 * 24)), "day");
  return date.toISOString().slice(0, 10);
}
