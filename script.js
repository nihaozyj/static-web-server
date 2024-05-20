document.addEventListener('DOMContentLoaded', () => {
  const dbRequest = indexedDB.open('AccountingDB', 1)

  dbRequest.onupgradeneeded = (event) => {
    const db = event.target.result
    const objectStore = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true })
    objectStore.createIndex('date', 'date', { unique: false })
    objectStore.createIndex('time', 'time', { unique: false })
    objectStore.createIndex('details', 'details', { unique: false })
    objectStore.createIndex('amount', 'amount', { unique: false })
  }

  dbRequest.onsuccess = (event) => {
    const db = event.target.result

    const form = document.getElementById('record-form')
    const detailsInput = document.getElementById('details')
    const amountInput = document.getElementById('amount')

    const updateStatistics = () => {
      const currentMonth = new Date().getMonth() + 1
      let totalIncome = 0
      let totalExpense = 0

      const transaction = db.transaction(['records'], 'readonly')
      const objectStore = transaction.objectStore('records')
      objectStore.openCursor().onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          const recordDate = new Date(cursor.value.date)
          if (recordDate.getMonth() + 1 === currentMonth) {
            if (cursor.value.amount >= 0) {
              totalIncome += cursor.value.amount
            } else {
              totalExpense += cursor.value.amount
            }
          }
          cursor.continue()
        } else {
          document.getElementById('income').textContent = `当月收入: ${totalIncome}`
          document.getElementById('expense').textContent = `当月支出: ${Math.abs(totalExpense)}`
        }
      }
    }

    const addRecord = () => {
      const amount = parseFloat(amountInput.value)
      if (amount === 0) {
        alert('金额不能为0')
        return
      }

      const now = new Date()
      const date = now.toISOString().split('T')[0]
      const time = now.toTimeString().split(' ')[0].substr(0, 5)
      const record = {
        date: date,
        time: time,
        details: detailsInput.value || '',
        amount: amount
      }
      const transaction = db.transaction(['records'], 'readwrite')
      const objectStore = transaction.objectStore('records')
      const request = objectStore.add(record)
      request.onsuccess = () => {
        addRecordToTable(record, request.result)
        updateStatistics()
        form.reset()
      }
    }

    form.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        addRecord()
      }
    })

    const addRecordToTable = (record, id) => {
      const tbody = document.getElementById('records-table-body')
      const tr = document.createElement('tr')
      tr.setAttribute('data-id', id)
      tr.innerHTML = `
                <td>${record.date}</td>
                <td>${record.time}</td>
                <td>${record.amount}</td>
                <td>${record.details}</td>
                <td><span class="delete-link">删除</span></td>
            `
      tbody.appendChild(tr)

      tr.querySelector('.delete-link').addEventListener('click', () => {
        const transaction = db.transaction(['records'], 'readwrite')
        const objectStore = transaction.objectStore('records')
        objectStore.delete(id).onsuccess = () => {
          tbody.removeChild(tr)
          updateStatistics()
        }
      })
    }

    const loadAllRecords = () => {
      const transaction = db.transaction(['records'], 'readonly')
      const objectStore = transaction.objectStore('records')
      objectStore.openCursor().onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          addRecordToTable(cursor.value, cursor.key)
          cursor.continue()
        }
        updateStatistics()
      }
    }

    const exportCSV = () => {
      const transaction = db.transaction(['records'], 'readonly')
      const objectStore = transaction.objectStore('records')
      const records = []

      objectStore.openCursor().onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          records.push(cursor.value)
          cursor.continue()
        } else {
          let csvContent = "data:text/csv;charset=utf-8,"
          csvContent += "日期,时间,金额,详细信息\n"
          records.forEach(record => {
            csvContent += `${record.date},${record.time},${record.amount},${record.details}\n`
          })

          const encodedUri = encodeURI(csvContent)
          const link = document.createElement("a")
          link.setAttribute("href", encodedUri)
          link.setAttribute("download", "records.csv")
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      }
    }

    const importCSV = (file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const csvData = event.target.result
        const rows = csvData.split("\n").slice(1)
        const records = []
        rows.forEach(row => {
          const [date, time, amount, details] = row.split(",")
          if (date && time && !isNaN(parseFloat(amount))) {
            records.push({ date, time, amount: parseFloat(amount), details: details || '' })
          }
        })

        const transaction = db.transaction(['records'], 'readwrite')
        const objectStore = transaction.objectStore('records')
        objectStore.clear().onsuccess = () => {
          records.forEach(record => {
            objectStore.add(record)
          })
          loadAllRecords()
          updateStatistics()
        }
      }
      reader.readAsText(file)
    }

    document.getElementById('export-csv').addEventListener('click', exportCSV)
    document.getElementById('import-csv').addEventListener('change', (event) => {
      const file = event.target.files[0]
      if (file) {
        importCSV(file)
      }
    })

    const dialog = document.getElementById('dialog')
    const openDialogButton = document.getElementById('backup-restore')
    const closeDialogButton = document.querySelector('.close-button')

    openDialogButton.addEventListener('click', () => {
      dialog.style.display = 'block'
    })

    closeDialogButton.addEventListener('click', () => {
      dialog.style.display = 'none'
    })

    window.addEventListener('click', (event) => {
      if (event.target === dialog) {
        dialog.style.display = 'none'
      }
    })

    loadAllRecords()
  }

  dbRequest.onerror = (event) => {
    console.error('数据库打开失败:', event.target.error)
  }
})
