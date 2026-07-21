# PyInstaller spec — builds the Flasqo backend into a self-contained sidecar
# that the Electron shell spawns. Build with:  pyinstaller flasqo-backend.spec
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

hiddenimports = (
    ['v3', 'request_builder', 'auto_discovery', 'vibe_testing', 'full_send']
    + collect_submodules('passlib')
    + collect_submodules('uvicorn')
    + collect_submodules('authlib')
    + ['sqlalchemy.dialects.sqlite', 'email_validator']
)

datas = [('static', 'static')] + collect_data_files('reportlab', include_py_files=False)

a = Analysis(
    ['backend.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'pandas'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='flasqo-backend',
    debug=False,
    strip=False,
    upx=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='flasqo-backend',
)
