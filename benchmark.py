#!/usr/bin/env python3
"""
Lana AI Performance & Latency Benchmarking Suite
------------------------------------------------
Measures:
  - Latency percentiles: Average, p50 (median), p95, p99, Min, Max
  - Time-To-First-Token (TTFT) for streaming responses
  - Success rate / Error rate / Timeout rate
  - Breakdown by query type / command (lookup, tx, flow, compare, dossier, ask)
  - Supports both direct API benchmarking and CLI subprocess benchmarking
"""

import argparse
import asyncio
import json
import math
import os
import platform
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure standard output and error support UTF-8 on Windows terminals
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Optional third-party imports with standard library fallbacks
try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Manual .env reader fallback
def _load_dotenv_manual():
    for candidate in [Path(".env"), Path("../.env"), Path(__file__).parent / ".env"]:
        if candidate.exists():
            try:
                with open(candidate, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k, v = k.strip(), v.strip().strip('"\'')
                            if k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass

_load_dotenv_manual()


# ---------------------------------------------------------------------------
# Benchmark Data Models
# ---------------------------------------------------------------------------

@dataclass
class QuerySample:
    query_type: str
    target: str
    system_prompt: str
    user_prompt: str
    cli_args: List[str]


@dataclass
class RequestResult:
    query_type: str
    status: str  # "SUCCESS", "ERROR", "TIMEOUT"
    status_code: Optional[int] = None
    total_latency_ms: float = 0.0
    ttft_ms: Optional[float] = None
    output_chars: int = 0
    estimated_tokens: int = 0
    error_message: Optional[str] = None
    timestamp: float = field(default_factory=time.time)


@dataclass
class AggregatedStats:
    count: int = 0
    success_count: int = 0
    error_count: int = 0
    timeout_count: int = 0
    success_rate_pct: float = 0.0
    error_rate_pct: float = 0.0
    timeout_rate_pct: float = 0.0
    
    # Latency (ms)
    avg_latency_ms: float = 0.0
    min_latency_ms: float = 0.0
    max_latency_ms: float = 0.0
    p50_latency_ms: float = 0.0
    p90_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    p99_latency_ms: float = 0.0
    
    # TTFT (ms)
    avg_ttft_ms: Optional[float] = None
    p50_ttft_ms: Optional[float] = None
    p95_ttft_ms: Optional[float] = None
    p99_ttft_ms: Optional[float] = None
    
    # Throughput
    avg_tokens_per_sec: Optional[float] = None


# ---------------------------------------------------------------------------
# Test Query Suite & Payloads
# ---------------------------------------------------------------------------

SAMPLE_QUERIES: List[QuerySample] = [
    QuerySample(
        query_type="lookup",
        target="9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        system_prompt="You are Helius Lana AI, a Solana forensic investigator. Output JSON profile with riskScore, labels, narrative, solBalance, totalTxCount.",
        user_prompt="Investigate Solana wallet address: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        cli_args=["lookup", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", "--json"]
    ),
    QuerySample(
        query_type="tx",
        target="5y9R2Z1Xw...sampleTxSig",
        system_prompt="You are Helius Lana AI. Explain transaction action, token movements, and program calls in JSON.",
        user_prompt="Explain Solana transaction signature: 5y9R2Z1XwJ8k7mPq3L4n5V6w7X8y9Z1A2B3C4D5E6F7G8H9J1K2L3M4N5P6Q7R8S9T1U2V3W4X5Y6Z",
        cli_args=["tx", "5y9R2Z1XwJ8k7mPq3L4n5V6w7X8y9Z1A2B3C4D5E6F7G8H9J1K2L3M4N5P6Q7R8S9T1U2V3W4X5Y6Z", "--json"]
    ),
    QuerySample(
        query_type="flow",
        target="675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
        system_prompt="You are Helius Lana AI. Trace multi-hop inflows and outflows for the address in JSON.",
        user_prompt="Trace fund flows for Solana address 675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8 with depth 2",
        cli_args=["flow", "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", "--depth", "2", "--json"]
    ),
    QuerySample(
        query_type="compare",
        target="9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM, 675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
        system_prompt="You are Helius Lana AI. Compare two Solana wallets for behavioral congruence and shared counterparties in JSON.",
        user_prompt="Compare these Solana addresses: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM, 675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
        cli_args=["compare", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", "--json"]
    ),
    QuerySample(
        query_type="dossier",
        target="9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        system_prompt="You are Helius Lana AI. Produce a comprehensive forensic case file dossier in JSON.",
        user_prompt="Compile a full forensic dossier for target Solana address: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        cli_args=["dossier", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", "--json"]
    ),
    QuerySample(
        query_type="ask",
        target="Natural Language Intelligence",
        system_prompt="You are Helius Lana AI, a premier Solana conversational intelligence assistant.",
        user_prompt="What are the top decentralized exchange aggregators on Solana by 24h trading volume?",
        cli_args=["ask", "What are the top decentralized exchange aggregators on Solana by 24h trading volume?", "--json"]
    ),
]


# ---------------------------------------------------------------------------
# Config Resolution
# ---------------------------------------------------------------------------

def resolve_api_key(explicit_key: Optional[str] = None) -> Optional[str]:
    if explicit_key and explicit_key.strip():
        return explicit_key.strip()
    for env_var in ["LANA_API_KEY", "HELIUS_API_KEY", "ORB_API_KEY"]:
        val = os.getenv(env_var)
        if val and val.strip():
            return val.strip()
    
    # Check ~/.config/lana/config.json
    config_path = Path.home() / ".config" / "lana" / "config.json"
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("apiKey"):
                    return data["apiKey"]
        except Exception:
            pass
    return None


def resolve_endpoint(explicit_endpoint: Optional[str] = None) -> str:
    url = explicit_endpoint or os.getenv("LANA_API_URL") or "https://lana-api.helius-experiments.com"
    url = url.strip().strip('"\'').rstrip("/")
    if not any(url.endswith(p) for p in ["/v1/messages", "/chat/completions", "/v1/lana"]):
        url = f"{url}/v1/messages"
    return url


# ---------------------------------------------------------------------------
# Execution Engines (Direct API & CLI Subprocess)
# ---------------------------------------------------------------------------

async def benchmark_api_request(
    client: "httpx.AsyncClient",
    sample: QuerySample,
    endpoint: str,
    api_key: str,
    model: str,
    stream: bool,
    timeout_sec: float
) -> RequestResult:
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "x-api-key": api_key,
        "api-key": api_key,
        "anthropic-version": "2023-06-01",
    }
    
    payload = {
        "model": model,
        "max_tokens": 4096,
        "system": sample.system_prompt,
        "messages": [{"role": "user", "content": sample.user_prompt}],
        "stream": stream,
    }

    start_time = time.perf_counter()
    ttft_ms: Optional[float] = None
    output_text = ""
    status_code: Optional[int] = None

    try:
        if stream:
            async with client.stream(
                "POST",
                endpoint,
                headers=headers,
                json=payload,
                timeout=timeout_sec
            ) as response:
                status_code = response.status_code
                if response.status_code >= 400:
                    err_body = await response.aread()
                    total_time = (time.perf_counter() - start_time) * 1000.0
                    return RequestResult(
                        query_type=sample.query_type,
                        status="ERROR",
                        status_code=status_code,
                        total_latency_ms=total_time,
                        error_message=f"HTTP {status_code}: {err_body.decode('utf-8', errors='ignore')[:200]}"
                    )

                first_chunk = True
                async for chunk in response.aiter_text():
                    if first_chunk and chunk.strip():
                        ttft_ms = (time.perf_counter() - start_time) * 1000.0
                        first_chunk = False
                    output_text += chunk

            total_latency_ms = (time.perf_counter() - start_time) * 1000.0
            return RequestResult(
                query_type=sample.query_type,
                status="SUCCESS",
                status_code=status_code,
                total_latency_ms=total_latency_ms,
                ttft_ms=ttft_ms,
                output_chars=len(output_text),
                estimated_tokens=max(1, len(output_text) // 4)
            )

        else:
            response = await client.post(
                endpoint,
                headers=headers,
                json=payload,
                timeout=timeout_sec
            )
            total_latency_ms = (time.perf_counter() - start_time) * 1000.0
            status_code = response.status_code

            if response.status_code >= 400:
                return RequestResult(
                    query_type=sample.query_type,
                    status="ERROR",
                    status_code=status_code,
                    total_latency_ms=total_latency_ms,
                    error_message=f"HTTP {status_code}: {response.text[:200]}"
                )

            data = response.json()
            # Extract content length
            text_content = ""
            if isinstance(data.get("content"), list):
                text_content = "".join(b.get("text", "") for b in data["content"] if isinstance(b, dict))
            elif isinstance(data.get("content"), str):
                text_content = data["content"]
            else:
                text_content = response.text

            return RequestResult(
                query_type=sample.query_type,
                status="SUCCESS",
                status_code=status_code,
                total_latency_ms=total_latency_ms,
                output_chars=len(text_content),
                estimated_tokens=max(1, len(text_content) // 4)
            )

    except httpx.TimeoutException:
        total_latency_ms = (time.perf_counter() - start_time) * 1000.0
        return RequestResult(
            query_type=sample.query_type,
            status="TIMEOUT",
            total_latency_ms=total_latency_ms,
            error_message=f"Request timed out after {timeout_sec:.1f}s"
        )
    except Exception as e:
        total_latency_ms = (time.perf_counter() - start_time) * 1000.0
        return RequestResult(
            query_type=sample.query_type,
            status="ERROR",
            status_code=status_code,
            total_latency_ms=total_latency_ms,
            error_message=str(e)[:200]
        )


async def benchmark_cli_subprocess(
    cli_path: str,
    sample: QuerySample,
    api_key: Optional[str],
    timeout_sec: float
) -> RequestResult:
    cmd = ["node", cli_path] + sample.cli_args
    if api_key:
        cmd += ["--apiKey", api_key]

    start_time = time.perf_counter()
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_sec)
            total_latency_ms = (time.perf_counter() - start_time) * 1000.0
            
            if proc.returncode == 0:
                out_str = stdout.decode("utf-8", errors="ignore")
                return RequestResult(
                    query_type=sample.query_type,
                    status="SUCCESS",
                    status_code=proc.returncode,
                    total_latency_ms=total_latency_ms,
                    output_chars=len(out_str),
                    estimated_tokens=max(1, len(out_str) // 4)
                )
            else:
                err_str = stderr.decode("utf-8", errors="ignore") or stdout.decode("utf-8", errors="ignore")
                return RequestResult(
                    query_type=sample.query_type,
                    status="ERROR",
                    status_code=proc.returncode,
                    total_latency_ms=total_latency_ms,
                    error_message=err_str[:200].strip()
                )
        except asyncio.TimeoutError:
            proc.kill()
            total_latency_ms = (time.perf_counter() - start_time) * 1000.0
            return RequestResult(
                query_type=sample.query_type,
                status="TIMEOUT",
                total_latency_ms=total_latency_ms,
                error_message=f"CLI execution timed out after {timeout_sec:.1f}s"
            )
    except Exception as e:
        total_latency_ms = (time.perf_counter() - start_time) * 1000.0
        return RequestResult(
            query_type=sample.query_type,
            status="ERROR",
            total_latency_ms=total_latency_ms,
            error_message=str(e)[:200]
        )


# ---------------------------------------------------------------------------
# Statistics Calculations
# ---------------------------------------------------------------------------

def calculate_percentile(sorted_values: List[float], percentile: float) -> float:
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    
    k = (len(sorted_values) - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_values[int(k)]
    d0 = sorted_values[int(f)] * (c - k)
    d1 = sorted_values[int(c)] * (k - f)
    return d0 + d1


def compute_statistics(results: List[RequestResult]) -> AggregatedStats:
    total = len(results)
    if total == 0:
        return AggregatedStats()

    successes = [r for r in results if r.status == "SUCCESS"]
    errors = [r for r in results if r.status == "ERROR"]
    timeouts = [r for r in results if r.status == "TIMEOUT"]

    success_count = len(successes)
    error_count = len(errors)
    timeout_count = len(timeouts)

    success_rate = (success_count / total) * 100.0
    error_rate = (error_count / total) * 100.0
    timeout_rate = (timeout_count / total) * 100.0

    # Calculate latency stats across successful queries (or all if none succeeded)
    target_samples = successes if successes else results
    latencies = sorted([r.total_latency_ms for r in target_samples])
    
    avg_lat = sum(latencies) / len(latencies) if latencies else 0.0
    min_lat = min(latencies) if latencies else 0.0
    max_lat = max(latencies) if latencies else 0.0
    p50_lat = calculate_percentile(latencies, 50)
    p90_lat = calculate_percentile(latencies, 90)
    p95_lat = calculate_percentile(latencies, 95)
    p99_lat = calculate_percentile(latencies, 99)

    # TTFT stats
    ttft_values = sorted([r.ttft_ms for r in successes if r.ttft_ms is not None])
    avg_ttft = (sum(ttft_values) / len(ttft_values)) if ttft_values else None
    p50_ttft = calculate_percentile(ttft_values, 50) if ttft_values else None
    p95_ttft = calculate_percentile(ttft_values, 95) if ttft_values else None
    p99_ttft = calculate_percentile(ttft_values, 99) if ttft_values else None

    # Tokens per sec throughput
    tok_speeds = [
        (r.estimated_tokens / (r.total_latency_ms / 1000.0))
        for r in successes
        if r.total_latency_ms > 0 and r.estimated_tokens > 0
    ]
    avg_tok_sec = (sum(tok_speeds) / len(tok_speeds)) if tok_speeds else None

    return AggregatedStats(
        count=total,
        success_count=success_count,
        error_count=error_count,
        timeout_count=timeout_count,
        success_rate_pct=round(success_rate, 2),
        error_rate_pct=round(error_rate, 2),
        timeout_rate_pct=round(timeout_rate, 2),
        avg_latency_ms=round(avg_lat, 2),
        min_latency_ms=round(min_lat, 2),
        max_latency_ms=round(max_lat, 2),
        p50_latency_ms=round(p50_lat, 2),
        p90_latency_ms=round(p90_lat, 2),
        p95_latency_ms=round(p95_lat, 2),
        p99_latency_ms=round(p99_lat, 2),
        avg_ttft_ms=round(avg_ttft, 2) if avg_ttft is not None else None,
        p50_ttft_ms=round(p50_ttft, 2) if p50_ttft is not None else None,
        p95_ttft_ms=round(p95_ttft, 2) if p95_ttft is not None else None,
        p99_ttft_ms=round(p99_ttft, 2) if p99_ttft is not None else None,
        avg_tokens_per_sec=round(avg_tok_sec, 2) if avg_tok_sec is not None else None,
    )


# ---------------------------------------------------------------------------
# Formatting & Terminal Output
# ---------------------------------------------------------------------------

class Color:
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    MAGENTA = "\033[95m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"


def print_banner(mode: str, endpoint: str, concurrency: int, iterations: int, stream: bool):
    print(f"\n{Color.CYAN}{Color.BOLD}" + "═" * 78 + f"{Color.RESET}")
    print(f"{Color.CYAN}{Color.BOLD}  ⚡ LANA AI PERFORMANCE & LATENCY BENCHMARK SUITE{Color.RESET}")
    print(f"{Color.CYAN}{Color.BOLD}" + "═" * 78 + f"{Color.RESET}")
    print(f"  {Color.BOLD}Mode:{Color.RESET}         {Color.GREEN}{mode.upper()}{Color.RESET}")
    print(f"  {Color.BOLD}Endpoint:{Color.RESET}     {endpoint}")
    print(f"  {Color.BOLD}Concurrency:{Color.RESET}  {concurrency} workers")
    print(f"  {Color.BOLD}Iterations:{Color.RESET}   {iterations} runs per query type ({iterations * len(SAMPLE_QUERIES)} total requests)")
    print(f"  {Color.BOLD}Streaming:{Color.RESET}    {'Enabled (Measuring TTFT)' if stream else 'Disabled'}")
    print(f"{Color.CYAN}" + "─" * 78 + f"{Color.RESET}\n")


def print_stats_table(title: str, stats: AggregatedStats, show_ttft: bool = False):
    print(f"\n{Color.BOLD}{title}{Color.RESET}")
    print("┌" + "─" * 26 + "┬" + "─" * 18 + "┬" + "─" * 30 + "┐")
    print(f"│ {'Metric':<24} │ {'Value':<16} │ {'Notes / Assessment':<28} │")
    print("├" + "─" * 26 + "┼" + "─" * 18 + "┼" + "─" * 30 + "┤")
    
    # Request summary
    success_color = Color.GREEN if stats.success_rate_pct >= 95 else (Color.YELLOW if stats.success_rate_pct >= 80 else Color.RED)
    print(f"│ Total Requests           │ {stats.count:<16} │ {stats.success_count} success, {stats.error_count} err, {stats.timeout_count} timeout │")
    print(f"│ Success Rate             │ {success_color}{stats.success_rate_pct:>6.2f}%{Color.RESET}          │ {'Target: > 99.0%' if stats.success_rate_pct >= 99 else 'Needs review'} │")
    print(f"│ Error Rate               │ {stats.error_rate_pct:>6.2f}%          │ {stats.error_count} failed requests        │")
    print(f"│ Timeout Rate             │ {stats.timeout_rate_pct:>6.2f}%          │ {stats.timeout_count} timed out requests     │")
    print("├" + "─" * 26 + "┼" + "─" * 18 + "┼" + "─" * 30 + "┤")
    
    # Latency summary
    print(f"│ Average Latency (Mean)   │ {Color.CYAN}{stats.avg_latency_ms:>8.2f} ms{Color.RESET}       │ Overall response time      │")
    print(f"│ Median Latency (p50)     │ {Color.CYAN}{stats.p50_latency_ms:>8.2f} ms{Color.RESET}       │ 50% of requests faster     │")
    print(f"│ 90th Percentile (p90)    │ {Color.YELLOW}{stats.p90_latency_ms:>8.2f} ms{Color.RESET}       │ 90% of requests faster     │")
    print(f"│ 95th Percentile (p95)    │ {Color.YELLOW}{stats.p95_latency_ms:>8.2f} ms{Color.RESET}       │ Tail latency (p95)         │")
    print(f"│ 99th Percentile (p99)    │ {Color.RED}{stats.p99_latency_ms:>8.2f} ms{Color.RESET}       │ Worst 1% latency           │")
    print(f"│ Min / Max Latency        │ {stats.min_latency_ms:.0f} / {stats.max_latency_ms:.0f} ms     │ Range (spread)             │")
    
    # TTFT section
    if show_ttft and stats.avg_ttft_ms is not None:
        print("├" + "─" * 26 + "┼" + "─" * 18 + "┼" + "─" * 30 + "┤")
        print(f"│ Avg TTFT (First Token)   │ {Color.MAGENTA}{stats.avg_ttft_ms:>8.2f} ms{Color.RESET}       │ Time to first stream chunk │")
        print(f"│ p50 TTFT (Median)        │ {Color.MAGENTA}{stats.p50_ttft_ms:>8.2f} ms{Color.RESET}       │ 50% TTFT faster            │")
        print(f"│ p95 TTFT                 │ {Color.MAGENTA}{stats.p95_ttft_ms:>8.2f} ms{Color.RESET}       │ 95% TTFT faster            │")
        print(f"│ p99 TTFT                 │ {Color.MAGENTA}{stats.p99_ttft_ms:>8.2f} ms{Color.RESET}       │ 99% TTFT faster            │")
    
    if stats.avg_tokens_per_sec:
        print("├" + "─" * 26 + "┼" + "─" * 18 + "┼" + "─" * 30 + "┤")
        print(f"│ Avg Token Throughput     │ {stats.avg_tokens_per_sec:>8.2f} tok/s    │ Estimated generation rate  │")

    print("└" + "─" * 26 + "┴" + "─" * 18 + "┴" + "─" * 30 + "┘")


def print_breakdown_table(breakdown: Dict[str, AggregatedStats], show_ttft: bool):
    print(f"\n{Color.BOLD}Latency & Reliability Breakdown by Query Type:{Color.RESET}")
    
    if show_ttft:
        header = f"┌─────────────┬───────┬─────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐"
        col_hdr = f"│ {'Command':<11} │ {'Runs':<5} │ {'Success':<7} │ {'Avg (ms)':<8} │ {'p50 (ms)':<8} │ {'p95 (ms)':<8} │ {'p99 (ms)':<8} │ {'TTFT p50':<8} │ {'TTFT p95':<8} │"
        divider = f"├─────────────┼───────┼─────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤"
        footer  = f"└─────────────┴───────┴─────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘"
    else:
        header = f"┌─────────────┬───────┬─────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐"
        col_hdr = f"│ {'Command':<11} │ {'Runs':<5} │ {'Success':<7} │ {'Avg (ms)':<8} │ {'p50 (ms)':<8} │ {'p90 (ms)':<8} │ {'p95 (ms)':<8} │ {'p99 (ms)':<8} │ {'Max (ms)':<8} │"
        divider = f"├─────────────┼───────┼─────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤"
        footer  = f"└─────────────┴───────┴─────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘"

    print(header)
    print(col_hdr)
    print(divider)

    for q_type, st in breakdown.items():
        succ_str = f"{st.success_rate_pct:.0f}%"
        if show_ttft:
            ttft_p50 = f"{st.p50_ttft_ms:.0f}" if st.p50_ttft_ms is not None else "-"
            ttft_p95 = f"{st.p95_ttft_ms:.0f}" if st.p95_ttft_ms is not None else "-"
            print(
                f"│ {q_type:<11} │ {st.count:<5} │ {succ_str:<7} │ {st.avg_latency_ms:>8.1f} │ {st.p50_latency_ms:>8.1f} │ {st.p95_latency_ms:>8.1f} │ {st.p99_latency_ms:>8.1f} │ {ttft_p50:>8} │ {ttft_p95:>8} │"
            )
        else:
            print(
                f"│ {q_type:<11} │ {st.count:<5} │ {succ_str:<7} │ {st.avg_latency_ms:>8.1f} │ {st.p50_latency_ms:>8.1f} │ {st.p90_latency_ms:>8.1f} │ {st.p95_latency_ms:>8.1f} │ {st.p99_latency_ms:>8.1f} │ {st.max_latency_ms:>8.1f} │"
            )

    print(footer)


# ---------------------------------------------------------------------------
# Runner Orchestration
# ---------------------------------------------------------------------------

async def run_benchmark(
    mode: str,
    api_key: str,
    endpoint: str,
    model: str,
    iterations: int,
    concurrency: int,
    timeout_sec: float,
    stream: bool,
    cli_path: str,
    filter_query: Optional[str] = None
) -> List[RequestResult]:
    # Prepare query queue
    queries_to_run = SAMPLE_QUERIES
    if filter_query:
        queries_to_run = [q for q in SAMPLE_QUERIES if q.query_type == filter_query.lower()]
        if not queries_to_run:
            print(f"{Color.RED}Error: Unknown query type '{filter_query}'. Available: lookup, tx, flow, compare, dossier, ask{Color.RESET}")
            sys.exit(1)

    work_items: List[QuerySample] = []
    for _ in range(iterations):
        for q in queries_to_run:
            work_items.append(q)

    results: List[RequestResult] = []
    semaphore = asyncio.Semaphore(concurrency)
    progress_count = 0
    total_items = len(work_items)

    print_banner(mode, endpoint if mode == "api" else cli_path, concurrency, iterations, stream)

    async def worker(sample: QuerySample, client: Optional["httpx.AsyncClient"]):
        nonlocal progress_count
        async with semaphore:
            if mode == "api":
                assert client is not None
                res = await benchmark_api_request(
                    client=client,
                    sample=sample,
                    endpoint=endpoint,
                    api_key=api_key,
                    model=model,
                    stream=stream,
                    timeout_sec=timeout_sec
                )
            else:
                res = await benchmark_cli_subprocess(
                    cli_path=cli_path,
                    sample=sample,
                    api_key=api_key,
                    timeout_sec=timeout_sec
                )
            results.append(res)
            progress_count += 1

            status_icon = (
                f"{Color.GREEN}✔{Color.RESET}" if res.status == "SUCCESS"
                else (f"{Color.YELLOW}⏱{Color.RESET}" if res.status == "TIMEOUT" else f"{Color.RED}✖{Color.RESET}")
            )
            ttft_info = f", TTFT: {res.ttft_ms:.0f}ms" if res.ttft_ms is not None else ""
            print(
                f"  [{progress_count:>{len(str(total_items))}}/{total_items}] {status_icon} "
                f"{res.query_type:<8} -> {res.status:<7} ({res.total_latency_ms:>7.1f} ms{ttft_info})"
                + (f" {Color.RED}[{res.error_message[:40]}]{Color.RESET}" if res.error_message else "")
            )

    if mode == "api":
        if not HAS_HTTPX:
            print(f"{Color.RED}Error: 'httpx' is required for direct API benchmarking. Run: pip install httpx{Color.RESET}")
            sys.exit(1)
        limits = httpx.Limits(max_keepalive_connections=concurrency * 2, max_connections=concurrency * 4)
        async with httpx.AsyncClient(limits=limits) as client:
            tasks = [asyncio.create_task(worker(item, client)) for item in work_items]
            await asyncio.gather(*tasks)
    else:
        tasks = [asyncio.create_task(worker(item, None)) for item in work_items]
        await asyncio.gather(*tasks)

    return results


# ---------------------------------------------------------------------------
# Export Helpers
# ---------------------------------------------------------------------------

def export_json(filepath: str, results: List[RequestResult], overall: AggregatedStats, breakdown: Dict[str, AggregatedStats]):
    output = {
        "benchmark_metadata": {
            "timestamp": time.time(),
            "date": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "total_samples": len(results),
        },
        "overall_statistics": asdict(overall),
        "breakdown_by_query_type": {k: asdict(v) for k, v in breakdown.items()},
        "raw_samples": [asdict(r) for r in results],
    }
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"\n{Color.GREEN}✔ Full JSON benchmark report saved to:{Color.RESET} {filepath}")


def export_csv(filepath: str, results: List[RequestResult]):
    import csv
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["query_type", "status", "status_code", "total_latency_ms", "ttft_ms", "output_chars", "estimated_tokens", "error_message"])
        for r in results:
            writer.writerow([r.query_type, r.status, r.status_code or "", r.total_latency_ms, r.ttft_ms or "", r.output_chars, r.estimated_tokens, r.error_message or ""])
    print(f"{Color.GREEN}✔ CSV raw samples saved to:{Color.RESET} {filepath}")


# ---------------------------------------------------------------------------
# CLI Argument Parser & Entry Point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Lana AI Performance & Latency Benchmark (p50, p95, p99, TTFT, error & timeout rates)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Measure direct API streaming latency (with TTFT) across 10 iterations:
  python benchmark.py --stream -n 10 -c 3

  # Benchmark the CLI binary execution speed:
  python benchmark.py --mode cli -n 5

  # Benchmark a single command type (e.g. lookup):
  python benchmark.py --query lookup -n 20

  # Export results to JSON and CSV reports:
  python benchmark.py -n 10 --json report.json --csv results.csv
        """
    )
    
    parser.add_argument("--mode", choices=["api", "cli"], default="api", help="Benchmark direct API endpoint or CLI subprocess (default: api)")
    parser.add_argument("-n", "--iterations", type=int, default=5, help="Number of test runs per query type (default: 5)")
    parser.add_argument("-c", "--concurrency", type=int, default=2, help="Number of concurrent workers (default: 2)")
    parser.add_argument("-t", "--timeout", type=float, default=45.0, help="Per-request timeout in seconds (default: 45.0)")
    parser.add_argument("-s", "--stream", action="store_true", help="Enable streaming to measure Time-To-First-Token (TTFT)")
    parser.add_argument("-q", "--query", type=str, choices=["lookup", "tx", "flow", "compare", "dossier", "ask"], help="Filter benchmark to a specific query type")
    parser.add_argument("--api-key", type=str, default=None, help="Lana / Helius API key override")
    parser.add_argument("--endpoint", type=str, default=None, help="Custom Lana API endpoint URL")
    parser.add_argument("--model", type=str, default="lana-fast", help="Model name identifier (default: lana-fast)")
    parser.add_argument("--cli-path", type=str, default="dist/index.js", help="Path to compiled CLI index.js for CLI mode (default: dist/index.js)")
    parser.add_argument("--json", dest="json_out", type=str, default=None, help="Filepath to export full JSON benchmark report")
    parser.add_argument("--csv", dest="csv_out", type=str, default=None, help="Filepath to export raw latency measurements as CSV")

    args = parser.parse_args()

    # Resolve API Key
    api_key = resolve_api_key(args.api_key)
    if not api_key:
        print(f"{Color.YELLOW}Warning: No API key detected. Set LANA_API_KEY in .env or pass --api-key <key>. Running against mock/fallback endpoint.{Color.RESET}")
        api_key = "demo-placeholder-key"

    endpoint = resolve_endpoint(args.endpoint)

    # Run Benchmark
    results = asyncio.run(
        run_benchmark(
            mode=args.mode,
            api_key=api_key,
            endpoint=endpoint,
            model=args.model,
            iterations=args.iterations,
            concurrency=args.concurrency,
            timeout_sec=args.timeout,
            stream=args.stream,
            cli_path=args.cli_path,
            filter_query=args.query
        )
    )

    if not results:
        print(f"{Color.RED}No benchmark samples recorded.{Color.RESET}")
        return

    # Compute overall statistics
    overall_stats = compute_statistics(results)

    # Compute per-query-type statistics
    breakdown_stats: Dict[str, AggregatedStats] = {}
    query_types = sorted(list(set(r.query_type for r in results)))
    for q_type in query_types:
        subset = [r for r in results if r.query_type == q_type]
        breakdown_stats[q_type] = compute_statistics(subset)

    # Print Summary Tables
    print_stats_table("OVERALL PERFORMANCE SUMMARY", overall_stats, show_ttft=args.stream)
    print_breakdown_table(breakdown_stats, show_ttft=args.stream)

    # Export if requested
    if args.json_out:
        export_json(args.json_out, results, overall_stats, breakdown_stats)
    if args.csv_out:
        export_csv(args.csv_out, results)

    print(f"\n{Color.GREEN}✔ Benchmark completed successfully.{Color.RESET}\n")


if __name__ == "__main__":
    main()
