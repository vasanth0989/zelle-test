[Shared prefix for the staged-evaluation INITIAL call — server prepends the
shield's own system prompt, then appends this instruction block:]

STAGED MODE: You have been given only an initial signal slice for a potentially
high-stakes payment. Make a preliminary read and decide whether you need the full
signal set before scoring. Return ONLY:
{"preliminary_score": <int 0-100>, "need_more": true|false,
 "step": "<one short line describing what you checked and why you do or don't
 need more data>"}
Request more data (need_more: true) when the initial signal is elevated OR the
stakes are high relative to the customer's baseline. Do not request more for
clearly routine readings on routine amounts.
