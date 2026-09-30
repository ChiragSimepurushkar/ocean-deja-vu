const fs = require('fs');
const logFile = 'C:/Users/simep/.gemini/antigravity-ide/brain/1f2b8549-63f4-4ae5-aac8-0f3a940f92c3/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logFile, 'utf8').split('\n');
let jsx = null;
let css = null;
for (const line of lines) {
  if (!line || !line.includes('write_to_file')) continue;
  try {
    const json = JSON.parse(line);
    if (!json.tool_calls) continue;
    for (const tool of json.tool_calls) {
      if (tool.name === 'write_to_file' && tool.args.TargetFile && tool.args.TargetFile.includes('DeepDive.jsx')) {
        jsx = tool.args.CodeContent;
      }
      if (tool.name === 'write_to_file' && tool.args.TargetFile && tool.args.TargetFile.includes('DeepDive.css')) {
        css = tool.args.CodeContent;
      }
    }
  } catch (e) {}
}

if (!jsx) {
    console.error("No jsx found");
    process.exit(1);
}

// Very careful targeted replacements
jsx = jsx.replace(/â˜€ï¸ /g, '☀️');
jsx = jsx.replace(/ðŸŒ¡ï¸ /g, '🌡️');
jsx = jsx.replace(/ðŸŒŠ/g, '🌊');
jsx = jsx.replace(/ðŸ”¦/g, '🔦');
jsx = jsx.replace(/âš“/g, '⚓');
jsx = jsx.replace(/â• /g, '='); // Fix box drawing borders
jsx = jsx.replace(/â”€/g, '-');
jsx = jsx.replace(/Â°/g, '°');
jsx = jsx.replace(/â‚‚/g, '₂');
jsx = jsx.replace(/Î”/g, 'Δ');
jsx = jsx.replace(/â€¢/g, '•');

fs.writeFileSync('C:/Users/simep/Desktop/Desktop/Computer_Science/Programming/SIH/frontend/src/pages/DeepDive.jsx', jsx, 'utf8');

if (css) {
    css = css.replace(/â• /g, '=');
    css = css.replace(/â”€/g, '-');
    fs.writeFileSync('C:/Users/simep/Desktop/Desktop/Computer_Science/Programming/SIH/frontend/src/pages/DeepDive.css', css, 'utf8');
}
console.log('Recovery script complete!');
