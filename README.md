# Install instructions

Setup Python packages.

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

# TODO
- `src/` is a combination of distribution and source and the example ipynb.
    - I can't seperate them out because the ipynb executes the python file
    in-place, so their paths need to be the same. 
    - Ideally, the nbextension would route execution but it doesn't.
    - We can maybe instead execute the Python through the extension beforehand
    ([Example of importing Python code from nbextension's js](https://github.com/ipython-contrib/jupyter_contrib_nbextensions/blob/374defd124b636e3337ef8e6249f3c67da6982b8/src/jupyter_contrib_nbextensions/nbextensions/varInspector/main.js#L210))