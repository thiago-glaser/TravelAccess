const fs = require('fs');

const files = [
  'components/Navbar.js',
  'app/page.js',
  'app/dashboard/other-expenses/page.js',
  'app/dashboard/maintenance/page.js',
  'app/dashboard/keys/page.js',
  'app/dashboard/insurance/page.js',
  'app/dashboard/fuel/page.js',
  'app/dashboard/expense-types/page.js',
  'app/dashboard/devices/page.js',
  'app/dashboard/cars/page.js',
  'app/dashboard/bluetooth/page.js'
];

files.forEach(file => {
   let content = fs.readFileSync(file, 'utf8');
   
   // Add the import if missing
   if (!content.includes('import Swal from')) {
       // Insert import below the first import
       content = content.replace(/(import[^;]+;)/, "$1\nimport Swal from 'sweetalert2';");
   }

   // regex to match if (!confirm(something)) ...
   content = content.replace(/if\s*\(\s*!\s*confirm\s*\((.*?)\)\s*\)\s*([{]?)\s*return\s*;?/g, (match, msg, brace) => {
       return `const result = await Swal.fire({ title: 'Confirmation', text: String(${msg}), icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33' });\n        if (!result.isConfirmed) return;`;
   });
   
   // replace page.js specific if (!confirm(...)) { return; } etc that might not use return immediately.
   content = content.replace(/if\s*\(\s*!\s*confirm\s*\((.*?)\)\s*\)\s*{\s*(return\s*;?)?\s*}/g, (match, msg) => {
       return `const result = await Swal.fire({ title: 'Confirmation', text: String(${msg}), icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33' });\n        if (!result.isConfirmed) return;`;
   });

   fs.writeFileSync(file, content, 'utf8');
});
console.log('Done!');
