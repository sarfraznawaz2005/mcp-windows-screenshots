# RegionSnip.exe --- Usage Prompt for LLMs

You are controlling a local Windows helper executable called
**RegionSnip.exe**.\
It captures screenshots and prints **exactly one JSON object to stdout**
for machines/agents to parse.

The tool supports two modes: - **region** (interactive): user selects an
area by dragging a rectangle - **full** (non-interactive): captures full
screen (single monitor or all monitors)

------------------------------------------------------------------------

## Command Line Arguments

### Required

-   `--out "<absolute_path_to_png>"`\
    Absolute output file path where the PNG will be saved.\
    The program automatically creates the directory if it does not
    exist.

### Optional

-   `--mode region|full`\
    Default: `region`

-   `--prompt "<text>"` *(region mode only)*\
    Text displayed on the overlay.\
    Default: `Drag to select an area. Press Esc to cancel.`

-   `--all` *(full mode only)*\
    Capture **all monitors** (virtual desktop).\
    Default: `false`

-   `--monitor N` *(full mode only)*\
    Capture a specific monitor using a **0-based index**.\
    Default: `0`\
    If the index is invalid, it falls back to monitor `0`.

------------------------------------------------------------------------

## Exit Behavior

-   On success → prints JSON with `ok: true`
-   On user cancel (Esc in region mode) → prints JSON with `ok: false`
    and `cancelled: true`
-   If `--out` is missing → prints an error JSON and exits with code `2`
-   On unexpected error → prints error JSON and exits with code `1`

------------------------------------------------------------------------

## Examples

### Selected Area Screenshot (Interactive)

``` powershell
RegionSnip.exe --mode region --out "C:\Temp\region.png"
```

Custom prompt:

``` powershell
RegionSnip.exe --mode region --prompt "Select the chart area" --out "C:\Temp\region.png"
```

User flow: 1. Screen dims with crosshair cursor 2. User click-drags a
rectangle 3. Release mouse to capture 4. Press **Esc** to cancel

------------------------------------------------------------------------

### Full Screenshot (Primary Monitor)

``` powershell
RegionSnip.exe --mode full --out "C:\Temp\full.png"
```

### Full Screenshot (Specific Monitor)

``` powershell
RegionSnip.exe --mode full --monitor 1 --out "C:\Temp\monitor-1.png"
```

### Full Screenshot (All Monitors / Virtual Desktop)

``` powershell
RegionSnip.exe --mode full --all --out "C:\Temp\all-monitors.png"
```

------------------------------------------------------------------------

## JSON Output Schema

### Success (Full Mode)

``` json
{
  "ok": true,
  "path": "C:\\Temp\\full.png",
  "mode": "full",
  "monitorIndex": 0,
  "all": false,
  "rect": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
  "width": 1920,
  "height": 1080
}
```

### Success (Region Mode)

``` json
{
  "ok": true,
  "path": "C:\\Temp\\region.png",
  "mode": "region",
  "rect": { "x": 412, "y": 233, "width": 681, "height": 402 },
  "width": 681,
  "height": 402
}
```

### Cancelled (Region Mode)

``` json
{
  "ok": false,
  "cancelled": true,
  "mode": "region"
}
```

### Error (Missing --out)

``` json
{
  "ok": false,
  "error": "Missing --out <path>"
}
```

------------------------------------------------------------------------

## Agent Guidelines

-   Always use **absolute paths** for `--out`
-   Always parse **stdout as JSON**
-   Treat `cancelled: true` as a user-driven cancel, not a failure
-   The screenshot file is valid **only when `ok: true`**
