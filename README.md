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

The JupyterLab extension also requires some stuff.

```
cd src/snp_jupyter
npm install
cd ../..
```

Install and enable the , and build `snp.ts`.

```
npm run build
```


Test it by opening jupyter and running `src/snp.ipynb`.

```
OPENAI_API_KEY=your_key jupyter notebook
```

If `OPENAI_API_KEY` is not provided, the AI panel will not show.

It should also work in Jupyter Lab:

```
OPENAI_API_KEY=your_key jupyter lab
```

If making screenshots, set `window.sessionStorage.setItem('make_stuff_nice_for_screenshots', 'true')`. This whitens the background, remove the execution counts and cell selection styling, and recenters the Plottery UI.

```javascript
%%javascript
window.sessionStorage.removeItem('make_stuff_nice_for_screenshots')
window.sessionStorage.setItem('make_stuff_nice_for_screenshots', 'true')
```

If making videos, set `in_demo_mode`. In addition to adding the `make_stuff_nice_for_screenshots` styling, this will make the plot slightly smaller and will surpress some distracting errors and warnings from Matplotlib.

```javascript
window.sessionStorage.removeItem('in_demo_mode')
window.sessionStorage.setItem('in_demo_mode', 'true')
```
