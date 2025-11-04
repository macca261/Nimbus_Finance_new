import os, subprocess
from openai import OpenAI

repo = os.environ["REPO"]
pr = os.environ["PR_NUMBER"]

# Get the PR diff
diff = subprocess.check_output(
    ["gh", "pr", "diff", pr, "--repo", repo, "--patch", "--color=never"],
    text=True
)

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

prompt = f"""
You are a senior TypeScript/Node/React reviewer for a money app.
- Point out bugs, flaky tests, type holes, unsafe parsing (CSV/encodings), and edge cases.
- Suggest SMALL, concrete patches as unified diffs when appropriate.
- If tests are missing, propose short test snippets.
One concise comment only.

Diff:
{diff}
"""

resp = client.chat.completions.create(
  model="gpt-4o-mini",
  messages=[{"role":"user","content":prompt}],
  temperature=0.2,
)

body = resp.choices[0].message.content

# Post as a single PR comment
subprocess.check_call(["gh","pr","comment",pr,"--repo",repo,"--body",body])

