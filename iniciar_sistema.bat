@echo off
chcp 65001 >nul
title Sistema de Pesquisa de Precos em Atas — PNCP
cd /d "%~dp0"

echo ============================================================================
echo   SISTEMA DE PESQUISA DE PRECOS EM ATAS DE REGISTRO DE PRECOS (PNCP)
echo ============================================================================
echo.

if exist "%LOCALAPPDATA%\PesquisaPrecosPNCP_venv\Scripts\python.exe" (
    echo Iniciando o sistema pelo ambiente virtual isolado...
    echo Aguarde: uma aba sera aberta automaticamente no seu navegador.
    echo Para encerrar o sistema, basta fechar esta janela preta.
    echo.
    "%LOCALAPPDATA%\PesquisaPrecosPNCP_venv\Scripts\python.exe" -m streamlit run app.py
) else if exist ".venv\Scripts\python.exe" (
    echo Iniciando o sistema pelo ambiente virtual local (.venv)...
    ".venv\Scripts\python.exe" -m streamlit run app.py
) else if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    echo Configurando ambiente virtual pela primeira vez...
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" -m venv "%LOCALAPPDATA%\PesquisaPrecosPNCP_venv"
    "%LOCALAPPDATA%\PesquisaPrecosPNCP_venv\Scripts\pip.exe" install -r requirements.txt
    "%LOCALAPPDATA%\PesquisaPrecosPNCP_venv\Scripts\python.exe" -m streamlit run app.py
) else (
    echo Erro: Ambiente Python nao encontrado.
    pause
)
