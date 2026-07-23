"""One Shield agents — portable LangGraph orchestrator for NeuroSecure.

Runs identically in two homes:
- locally, wired into backend/app.py behind ONESHIELD_AGENT=1 (Ollama);
- copied into the team's Jupyter sandbox workspace (c1 / llama-4-scout) —
  set ONESHIELD_LLM_PROVIDER=c1 and use notebook.run_scenario.
"""
from .agent import compile_agent, run_investigation
from .notebook import arun_scenario, run_scenario

__all__ = ["compile_agent", "run_investigation", "arun_scenario", "run_scenario"]
