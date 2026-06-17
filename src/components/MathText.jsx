import katex from "katex";

// Renders a string, KaTeX-rendering math delimited by $...$ (inline), \(...\) (inline),
// or \[...\] (display). Plain text (including newlines) is rendered as-is. Used for homework
// prompts and correct-answer reveals.
export function MathText({ children, style }) {
  const text = String(children ?? "");
  const re = /\$([^$]+)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
  const nodes = [];
  let last = 0, m, key = 0;

  const pushText = str => {
    const lines = str.split("\n");
    lines.forEach((line, i) => {
      if (i > 0) nodes.push(<br key={`br${key++}`} />);
      if (line) nodes.push(<span key={`t${key++}`}>{line}</span>);
    });
  };

  while ((m = re.exec(text))) {
    if (m.index > last) pushText(text.slice(last, m.index));
    const display = m[3] != null;
    const tex = m[1] ?? m[2] ?? m[3] ?? "";
    let html;
    try { html = katex.renderToString(tex, { throwOnError: false, displayMode: display }); }
    catch { html = tex; }
    nodes.push(<span key={`m${key++}`} dangerouslySetInnerHTML={{ __html: html }} />);
    last = re.lastIndex;
  }
  if (last < text.length) pushText(text.slice(last));

  return <span style={style}>{nodes}</span>;
}
