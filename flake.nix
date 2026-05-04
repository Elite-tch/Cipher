{
  description = "Cipher - Logos DApp (Lean Edition)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        # Development environment shell
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            nodePackages.npm
            git
          ];

          shellHook = ''
            echo "🚀 Cipher DApp Dev Environment Loaded!"
            echo "Node.js Version: $(node -v)"
            echo "NPM Version: $(npm -v)"
            echo ""
            echo "Run 'npm install' and 'npm run dev' to start."
          '';
        };

        # Package derivation for Logos App Launcher integration
        packages.default = pkgs.buildNpmPackage {
          pname = "cipher-dapp";
          version = "0.1.0";

          src = ./.;

          # If package-lock.json changes, this hash needs updating
          # For development, you can use lib.fakeHash
          npmDepsHash = pkgs.lib.fakeHash;

          buildInputs = with pkgs; [
            nodejs_20
          ];

          # Custom build phase for Next.js
          buildPhase = ''
            runHook preBuild
            npm run build
            runHook postBuild
          '';

          # Install phase to expose the built Next.js app
          installPhase = ''
            runHook preInstall
            mkdir -p $out/bin $out/share/cipher-dapp
            cp -r .next package.json node_modules public $out/share/cipher-dapp/
            
            # Create a runner script
            cat <<EOF > $out/bin/cipher-dapp
            #!/usr/bin/env bash
            cd $out/share/cipher-dapp
            ${pkgs.nodejs_20}/bin/npm run start
            EOF
            chmod +x $out/bin/cipher-dapp
            
            runHook postInstall
          '';

          meta = with pkgs.lib; {
            description = "Cipher - Sovereign Social Feed on Logos Network";
            license = licenses.mit;
            maintainers = [ ];
          };
        };
      }
    );
}
