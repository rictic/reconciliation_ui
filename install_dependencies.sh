set -e  # stop on first error

git clone https://github.com/joyent/node.git
cd node
git checkout origin/v0.10
./configure --prefix=$HOME
make -j
make install
cd ..
export PATH=$PATH:$HOME/bin
npm install -g typescript
./build.sh

echo "If you see this, everything worked!"
echo "You may need to add $HOME/bin to your PATH in your startup script."
echo "I've done that temporarily here already though."
