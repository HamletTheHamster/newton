// Turns bare URLs inside plain instructor prose into real links.
//
// Everything an instructor types is PLAIN TEXT (house style: no markdown, so there is no `[…](…)`
// to parse), which means a URL in a syllabus policy or a course-guide step arrives as characters.
// Rendering it as characters gives the student something they have to select and paste by hand.
//
// It lives here rather than in utils.js because it returns JSX, and utils.js is a `.js` file that
// Vite does not run through the JSX loader. Shared by StudentSyllabus and CourseGuide so the two
// cannot drift on what counts as a link.
export function renderWithLinks(text, linkColor) {
  if (!text) return text;
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const parts = [];
  let last = 0;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const url = match[0];
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" style={{ color: linkColor, textDecoration: "underline" }}>{url}</a>
    );
    last = match.index + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}
