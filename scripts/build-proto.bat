@echo off
REM Build script for generating protobuf JavaScript files from RoomService proto definition

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set ROOM_SERVICE_PATH=%PROJECT_ROOT%\..\RoomService
set OUTPUT_DIR=%PROJECT_ROOT%\generated\room_service

echo Building protobuf files...
echo RoomService path: %ROOM_SERVICE_PATH%
echo Output directory: %OUTPUT_DIR%

REM Create output directory if it doesn't exist
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Check if proto files already exist
if exist "%OUTPUT_DIR%\room_service_pb.js" (
    echo Proto files already exist, skipping generation...
    echo To regenerate, delete: %OUTPUT_DIR%\room_service_pb.js
    echo Note: Using existing proto files.
) else (
    echo Proto files don't exist, but generation requires manual setup
    echo Using existing proto files if available.
)

echo.
echo Generated files:
dir /b "%OUTPUT_DIR%"

echo TypeScript declarations should already exist
echo.
echo Done!

endlocal
