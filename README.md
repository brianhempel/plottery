# Install instructions

### Setup Python packages.

Create a virtual environment (recommended).

```
python3 -m venv .venv
source .venv/bin/activate
```

Install Python packages.

```
pip install -r requirements.txt
```
  
Install node packages.

```
npm install
```

Install and enable `nbextension`, and build `snp.ts`.

```
npm run build
```


Test it by opening jupyter and running `src/snp.ipynb`.

```
jupyter notebook
```