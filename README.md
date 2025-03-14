# Tauri + Vue + TypeScript

This solves a problem with broken notifications from on-prem hosted bitbucket

<img width="1086" alt="image" src="https://github.com/user-attachments/assets/85f49bad-a9ef-4b31-9c63-3bcb1b7630bb" />

<img width="1479" alt="image" src="https://github.com/user-attachments/assets/91876592-d0a5-4349-a25e-6045cc152c5c" />

<img width="146" alt="image" src="https://github.com/user-attachments/assets/ca56b67d-afd3-4d66-9fcb-82932fa5754a" />

<img width="1477" alt="image" src="https://github.com/user-attachments/assets/0c3d3c46-eaf4-4bb7-a744-02e4e1ef4ecb" />

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Type Support For `.vue` Imports in TS

Since TypeScript cannot handle type information for `.vue` imports, they are shimmed to be a generic Vue component type by default. In most cases this is fine if you don't really care about component prop types outside of templates. However, if you wish to get actual prop types in `.vue` imports (for example to get props validation when using manual `h(...)` calls), you can enable Volar's Take Over mode by following these steps:

1. Run `Extensions: Show Built-in Extensions` from VS Code's command palette, look for `TypeScript and JavaScript Language Features`, then right click and select `Disable (Workspace)`. By default, Take Over mode will enable itself if the default TypeScript extension is disabled.
2. Reload the VS Code window by running `Developer: Reload Window` from the command palette.

You can learn more about Take Over mode [here](https://github.com/johnsoncodehk/volar/discussions/471).
