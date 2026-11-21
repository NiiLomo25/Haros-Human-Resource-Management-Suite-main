; Haros HRMIS — custom NSIS hooks (electron-builder include script)
;
; electron-builder installs into <chosen dir>\<productName> when the user picks
; a custom installation directory. Its uninstaller removes $INSTDIR but leaves
; the user-chosen parent folder behind as an empty directory tree. The macro
; below removes that parent — but only when empty (RMDir without /r fails
; silently on non-empty dirs), so it can never delete user data. All HRMIS
; data lives under %LOCALAPPDATA%\HRMIS, outside the install tree entirely.

!macro customUnInstall
  ; $INSTDIR during uninstall is the recorded install dir, e.g.
  ; C:\Program Files\Haros HRMIS\Haros HRMIS — its parent is the folder the
  ; user originally selected in the installer.
  RMDir "$INSTDIR\.."
!macroend
