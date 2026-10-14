# 바탕화면에 블로그 바로가기를 만든다.
# 아이콘(assets/blog.ico)이 없으면 함께 생성한다.
#
#   powershell -ExecutionPolicy Bypass -File make-shortcut.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
$icoPath = Join-Path $root 'assets\blog.ico'

function New-IconBitmap([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $s = $size / 64.0
    $accent = [System.Drawing.Color]::FromArgb(255, 52, 81, 199)

    # 둥근 사각형 배경
    $r = 14 * $s
    $bg = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bg.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
    $bg.AddArc($size - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
    $bg.AddArc($size - 2 * $r, $size - 2 * $r, 2 * $r, 2 * $r, 0, 90)
    $bg.AddArc(0, $size - 2 * $r, 2 * $r, 2 * $r, 90, 90)
    $bg.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush $accent), $bg)

    # 종이
    $page = New-Object System.Drawing.Drawing2D.GraphicsPath
    $page.AddLines([System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF (17 * $s), (12 * $s)),
        (New-Object System.Drawing.PointF (38 * $s), (12 * $s)),
        (New-Object System.Drawing.PointF (47 * $s), (21 * $s)),
        (New-Object System.Drawing.PointF (47 * $s), (54 * $s)),
        (New-Object System.Drawing.PointF (17 * $s), (54 * $s))
    ))
    $page.CloseFigure()
    $g.FillPath([System.Drawing.Brushes]::White, $page)

    # 접힌 모서리
    $fold = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF (38 * $s), (12 * $s)),
        (New-Object System.Drawing.PointF (38 * $s), (21 * $s)),
        (New-Object System.Drawing.PointF (47 * $s), (21 * $s))
    )
    $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 201, 211, 246))), $fold)

    # 글줄
    $pen = New-Object System.Drawing.Pen $accent, ([Math]::Max(1.0, 3 * $s))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($pen, 23 * $s, 29 * $s, 41 * $s, 29 * $s)
    $g.DrawLine($pen, 23 * $s, 37 * $s, 41 * $s, 37 * $s)
    $g.DrawLine($pen, 23 * $s, 45 * $s, 34 * $s, 45 * $s)

    $g.Dispose()
    return $bmp
}

function New-IcoFile([string]$path) {
    $sizes = 256, 64, 48, 32, 16
    $images = foreach ($size in $sizes) {
        $bmp = New-IconBitmap $size
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        , $ms.ToArray()
    }

    $out = New-Object System.IO.MemoryStream
    $w = New-Object System.IO.BinaryWriter $out
    $w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $dim = if ($sizes[$i] -ge 256) { 0 } else { $sizes[$i] }
        $w.Write([Byte]$dim); $w.Write([Byte]$dim)
        $w.Write([Byte]0); $w.Write([Byte]0)
        $w.Write([UInt16]1); $w.Write([UInt16]32)
        $w.Write([UInt32]$images[$i].Length); $w.Write([UInt32]$offset)
        $offset += $images[$i].Length
    }
    foreach ($img in $images) { $w.Write($img) }
    $w.Flush()
    [System.IO.File]::WriteAllBytes($path, $out.ToArray())
}

if (-not (Test-Path $icoPath)) {
    New-IcoFile $icoPath
}

# Python 찾기: py 런처를 우선 사용 (Python을 업그레이드해도 바로가기가 깨지지 않음)
$py = Get-Command py.exe -ErrorAction SilentlyContinue
if ($py) {
    $target = $py.Source
    $arguments = "-3 `"$root\serve.py`""
} else {
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if (-not $python) { throw 'Python을 찾을 수 없습니다. https://www.python.org 에서 설치해 주세요.' }
    $target = $python.Source
    $arguments = "`"$root\serve.py`""
}

$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop '블로그.lnk'

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath = $target
$lnk.Arguments = $arguments
$lnk.WorkingDirectory = $root
$lnk.IconLocation = "$icoPath,0"
$lnk.WindowStyle = 7  # 서버 창은 최소화된 상태로 시작
$lnk.Description = '블로그 열기 (로컬 서버 실행 후 브라우저로 열기)'
$lnk.Save()

Write-Output "바로가기 생성: $lnkPath"
